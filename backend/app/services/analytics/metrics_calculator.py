from __future__ import annotations

import numpy as np
import pandas as pd  # type: ignore[import-untyped]

from app.schemas.metrics import FlightMetrics
from app.utils.geo import haversine_distance_m, total_haversine_distance
from app.utils.integration import trapezoidal_integrate


class MetricsCalculator:
    @staticmethod
    def filter_gps_outliers(
        gps_df: pd.DataFrame,
        max_segment_m: float = 1000.0,
        max_speed_mps: float = 120.0,
    ) -> tuple[pd.DataFrame, int]:
        """Remove GPS samples that create physically implausible jumps.

        Consecutive segments are marked valid if they satisfy both distance and
        speed thresholds. A point is kept when it has at least one valid
        adjacent segment. This removes isolated GPS glitches (including a bad
        first sample) while preserving continuous valid trajectory portions.
        """

        if gps_df.empty:
            return gps_df.copy(), 0

        ordered = gps_df.sort_values("time_s").reset_index(drop=True)
        n = len(ordered)
        if n < 2:
            return ordered, 0

        # Mark each consecutive segment as valid/invalid.
        segment_valid = np.zeros(n - 1, dtype=bool)
        for seg_idx in range(n - 1):
            prev = ordered.iloc[seg_idx]
            curr = ordered.iloc[seg_idx + 1]

            dt = float(curr["time_s"] - prev["time_s"])
            if dt <= 0:
                continue

            distance_m = haversine_distance_m(
                float(prev["lat"]),
                float(prev["lon"]),
                float(curr["lat"]),
                float(curr["lon"]),
            )
            if not np.isfinite(distance_m):
                continue

            speed_mps = distance_m / dt
            segment_valid[seg_idx] = distance_m <= max_segment_m and speed_mps <= max_speed_mps

        # Keep points that connect to at least one valid neighbor segment.
        keep_mask = np.zeros(n, dtype=bool)
        keep_mask[0] = bool(segment_valid[0])
        keep_mask[-1] = bool(segment_valid[-1])
        if n > 2:
            keep_mask[1:-1] = segment_valid[:-1] | segment_valid[1:]

        if not keep_mask.any():
            # Avoid collapsing the mission completely if all segments fail.
            return ordered, 0

        filtered = ordered.loc[keep_mask].reset_index(drop=True)
        dropped = int((~keep_mask).sum())
        return filtered, dropped

    @staticmethod
    def _imu_merge_tolerance_s(imu_time_s: np.ndarray) -> float | None:
        if len(imu_time_s) < 2:
            return None
        deltas = np.diff(imu_time_s)
        positive = deltas[deltas > 0]
        if len(positive) == 0:
            return None
        return float(np.median(positive) * 1.5)

    @staticmethod
    def compute_telemetry(gps_df: pd.DataFrame, imu_df: pd.DataFrame) -> pd.DataFrame:
        telemetry = gps_df.copy()
        telemetry = telemetry.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})
        telemetry = telemetry.sort_values("time_s").reset_index(drop=True)

        if not imu_df.empty:
            imu_enriched = imu_df.copy().sort_values("time_s").reset_index(drop=True)

            if "acc_mag_mps2" not in imu_enriched.columns:
                imu_enriched["acc_mag_mps2"] = np.sqrt(
                    imu_enriched["acc_x"] ** 2 + imu_enriched["acc_y"] ** 2 + imu_enriched["acc_z"] ** 2
                )

            imu_time_series = imu_enriched["time_s"].to_numpy()
            imu_acc_series = imu_enriched["acc_mag_mps2"].ffill().fillna(0).to_numpy()
            imu_enriched["imu_velocity_mps"] = trapezoidal_integrate(imu_time_series, imu_acc_series)

            merge_kwargs: dict[str, object] = {
                "on": "time_s",
                "direction": "nearest",
            }
            tolerance_s = MetricsCalculator._imu_merge_tolerance_s(imu_time_series)
            if tolerance_s is not None:
                merge_kwargs["tolerance"] = tolerance_s

            telemetry = pd.merge_asof(
                telemetry,
                imu_enriched[["time_s", "acc_mag_mps2", "imu_velocity_mps"]],
                **merge_kwargs,
            )

        # Derive vertical speed if not provided
        if "vz_mps" not in telemetry.columns or telemetry["vz_mps"].isna().all():
            telemetry["vertical_speed_mps"] = telemetry["altitude_m"].diff() / telemetry["time_s"].diff()
        else:
            telemetry["vertical_speed_mps"] = telemetry["vz_mps"]

        # Horizontal speed fallback: compute from positions if missing
        if "spd_mps" not in telemetry.columns or telemetry["spd_mps"].isna().all():
            telemetry["speed_mps"] = np.nan
            for idx in range(1, len(telemetry)):
                p1 = telemetry.iloc[idx - 1]
                p2 = telemetry.iloc[idx]
                dt = p2["time_s"] - p1["time_s"]
                if dt <= 0:
                    continue
                d = haversine_distance_m(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])
                telemetry.loc[idx, "speed_mps"] = d / dt
        else:
            telemetry["speed_mps"] = telemetry["spd_mps"]

        return telemetry

    @staticmethod
    def compute_metrics(telemetry: pd.DataFrame, imu_df: pd.DataFrame | None = None) -> FlightMetrics:
        if telemetry.empty:
            return FlightMetrics(
                total_duration_sec=0.0,
                max_horizontal_speed_mps=0.0,
                max_vertical_speed_mps=0.0,
                max_acceleration_mps2=0.0,
                max_altitude_gain_m=0.0,
                total_distance_m=0.0,
            )

        times = telemetry["time_s"].to_numpy()
        duration = float(times.max() - times.min()) if len(times) else 0.0

        horizontal_speed = telemetry["speed_mps"].fillna(0)
        vertical_speed = telemetry["vertical_speed_mps"].fillna(0)

        if imu_df is not None and not imu_df.empty:
            imu_acc = imu_df.copy()
            if "acc_mag_mps2" not in imu_acc.columns:
                imu_acc["acc_mag_mps2"] = np.sqrt(
                    imu_acc["acc_x"] ** 2 + imu_acc["acc_y"] ** 2 + imu_acc["acc_z"] ** 2
                )
            accel = imu_acc["acc_mag_mps2"].fillna(0)
        else:
            accel = telemetry.get("acc_mag_mps2", pd.Series(dtype=float)).fillna(0)

        coords = telemetry[["latitude", "longitude"]].dropna().to_records(index=False)
        total_distance = total_haversine_distance(coords)

        max_alt_gain = float(telemetry["altitude_m"].max() - telemetry["altitude_m"].min())

        return FlightMetrics(
            total_duration_sec=duration,
            max_horizontal_speed_mps=float(horizontal_speed.max()),
            max_vertical_speed_mps=float(vertical_speed.abs().max()),
            max_acceleration_mps2=float(accel.abs().max()) if not accel.empty else 0.0,
            max_altitude_gain_m=max_alt_gain,
            total_distance_m=total_distance,
        )
