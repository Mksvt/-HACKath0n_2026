from __future__ import annotations

import numpy as np
import pandas as pd  # type: ignore[import-untyped]

from app.schemas.metrics import FlightMetrics
from app.utils.geo import haversine_distance_m, total_haversine_distance
from app.utils.integration import trapezoidal_integrate


class MetricsCalculator:
    @staticmethod
    def compute_telemetry(gps_df: pd.DataFrame, imu_df: pd.DataFrame) -> pd.DataFrame:
        telemetry = gps_df.copy()
        telemetry = telemetry.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})

        if not imu_df.empty:
            telemetry = telemetry.merge(imu_df[["time_s", "acc_mag_mps2"]], how="left", on="time_s")
            telemetry = telemetry.sort_values("time_s").reset_index(drop=True)

        if "vz_mps" not in telemetry.columns or telemetry["vz_mps"].isna().all():
            telemetry["vertical_speed_mps"] = telemetry["altitude_m"].diff() / telemetry["time_s"].diff()
        else:
            telemetry["vertical_speed_mps"] = telemetry["vz_mps"]

        if "spd_mps" not in telemetry.columns or telemetry["spd_mps"].isna().all():
            telemetry["speed_mps"] = telemetry.apply(
                lambda row: np.nan,
                axis=1,
            )
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

        if "acc_mag_mps2" in telemetry.columns and telemetry["acc_mag_mps2"].notna().any():
            time_series = telemetry["time_s"].to_numpy()
            acc_series = telemetry["acc_mag_mps2"].fillna(method="ffill").fillna(0).to_numpy()
            telemetry["imu_velocity_mps"] = trapezoidal_integrate(time_series, acc_series)

        return telemetry

    @staticmethod
    def compute_metrics(telemetry: pd.DataFrame) -> FlightMetrics:
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
