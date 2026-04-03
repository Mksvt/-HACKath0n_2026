from __future__ import annotations

from math import isfinite
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd  # type: ignore[import-untyped]
from loguru import logger
from pymavlink import mavutil  # type: ignore[import-untyped]

from app.utils.geo import haversine_distance_m, sampling_frequency


class ArdupilotLogParser:
    """Minimal Ardupilot .BIN parser using pymavlink.

    Assumptions documented for clarity:
    - GPS Lat/Lng can be reported either as decimal degrees or as scaled integers
      (commonly 1e7 in Ardupilot DataFlash logs). We auto-normalize to decimal
      degrees.
    - GPS Alt is reported in centimeters; we normalize to meters.
    - GPS Spd/VZ may be logged either as m/s or cm/s depending on firmware/log
      profile. We infer a scale factor (1 or 0.01) from the trajectory and store
      normalized values as m/s.
    - IMU AccX/Y/Z are treated as m/s^2 (Ardupilot logs store m/s^2). Any bias or
      gravity compensation is left to downstream consumers; a note about IMU
      drift is included elsewhere.
    """

    @staticmethod
    def _infer_scale_from_reference(
        raw_values: np.ndarray,
        reference_magnitude: float | None,
        threshold_without_reference: float,
    ) -> float:
        finite = np.abs(raw_values[np.isfinite(raw_values)])
        if finite.size == 0:
            return 1.0

        raw_p90 = float(np.percentile(finite, 90))
        if reference_magnitude is None or reference_magnitude <= 0:
            return 0.01 if raw_p90 > threshold_without_reference else 1.0

        ref = max(reference_magnitude, 1e-6)
        candidates = (1.0, 0.01)
        best = min(candidates, key=lambda scale: abs(np.log(max(raw_p90 * scale, 1e-6) / ref)))
        return float(best)

    @staticmethod
    def _gps_speed_reference(gps_df: pd.DataFrame) -> float | None:
        if gps_df.empty or len(gps_df) < 3:
            return None

        lat = gps_df["lat"].to_numpy(dtype=float)
        lon = gps_df["lon"].to_numpy(dtype=float)
        times = gps_df["time_s"].to_numpy(dtype=float)

        derived: list[float] = []
        for idx in range(1, len(gps_df)):
            dt = times[idx] - times[idx - 1]
            if dt <= 0:
                continue
            distance_m = haversine_distance_m(lat[idx - 1], lon[idx - 1], lat[idx], lon[idx])
            # Ignore obvious GPS glitches while estimating a representative speed.
            if not np.isfinite(distance_m) or distance_m > 1000:
                continue
            derived.append(distance_m / dt)

        if not derived:
            return None
        return float(np.percentile(np.abs(np.array(derived)), 90))

    @staticmethod
    def _vertical_speed_reference(gps_df: pd.DataFrame) -> float | None:
        if gps_df.empty or len(gps_df) < 3:
            return None

        alt = gps_df["alt_m"].to_numpy(dtype=float)
        times = gps_df["time_s"].to_numpy(dtype=float)
        dt = np.diff(times)
        dalt = np.diff(alt)

        valid = dt > 0
        if not np.any(valid):
            return None
        vz = np.abs(dalt[valid] / dt[valid])
        finite = vz[np.isfinite(vz)]
        if finite.size == 0:
            return None
        return float(np.percentile(finite, 90))

    @staticmethod
    def _normalize_coordinate(raw_value: Any, axis_limit_deg: float) -> float | None:
        """Normalize latitude/longitude values to decimal degrees.

        Ardupilot logs can store coordinates directly in degrees or in scaled
        integer formats (most often 1e7). We try known scales and accept the
        first value that fits the latitude/longitude domain.
        """

        if raw_value is None:
            return None

        value = float(raw_value)
        if not isfinite(value):
            return None

        if abs(value) <= axis_limit_deg:
            return value

        for scale in (1e7, 1e6, 1e5):
            candidate = value / scale
            if abs(candidate) <= axis_limit_deg:
                return candidate

        return None

    def parse(self, log_path: Path) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        gps_records: list[Dict[str, Any]] = []
        imu_records: list[Dict[str, Any]] = []
        att_records: list[Dict[str, Any]] = []

        logger.info("Parsing Ardupilot log {}", log_path)
        mlog = mavutil.mavlink_connection(str(log_path))

        while True:
            msg = mlog.recv_match(blocking=True)
            if msg is None:
                break
            msg_type = msg.get_type()

            if msg_type.startswith("GPS"):
                lat_raw = getattr(msg, "Lat", None)
                lon_raw = getattr(msg, "Lng", None)
                alt_raw = getattr(msg, "Alt", None)
                if lat_raw is None or lon_raw is None or alt_raw is None:
                    continue
                lat_deg = self._normalize_coordinate(lat_raw, axis_limit_deg=90.0)
                lon_deg = self._normalize_coordinate(lon_raw, axis_limit_deg=180.0)
                if lat_deg is None or lon_deg is None:
                    continue
                time_us = getattr(msg, "TimeUS", None) or getattr(msg, "time_usec", None)
                time_s = float(time_us) / 1_000_000.0 if time_us is not None else None
                gps_records.append(
                    {
                        "time_s": time_s,
                        "lat": lat_deg,
                        "lon": lon_deg,
                        "alt_m": float(alt_raw) / 100.0,
                        "spd_raw": float(getattr(msg, "Spd", 0.0)),
                        "vz_raw": float(getattr(msg, "VZ", 0.0)),
                    }
                )

            if msg_type.startswith("IMU"):
                time_us = getattr(msg, "TimeUS", None)
                time_s = float(time_us) / 1_000_000.0 if time_us is not None else None
                imu_records.append(
                    {
                        "time_s": time_s,
                        "acc_x": float(getattr(msg, "AccX", 0.0)),
                        "acc_y": float(getattr(msg, "AccY", 0.0)),
                        "acc_z": float(getattr(msg, "AccZ", 0.0)),
                    }
                )

            if msg_type == "ATT":
                time_us = getattr(msg, "TimeUS", None)
                time_s = float(time_us) / 1_000_000.0 if time_us is not None else None
                att_records.append(
                    {
                        "time_s": time_s,
                        "roll": float(getattr(msg, "Roll", 0.0)),
                        "pitch": float(getattr(msg, "Pitch", 0.0)),
                        "yaw": float(getattr(msg, "Yaw", 0.0)),
                    }
                )

        gps_df = pd.DataFrame(gps_records).dropna(subset=["lat", "lon", "alt_m", "time_s"])
        imu_df = pd.DataFrame(imu_records).dropna(subset=["time_s"])
        att_df = pd.DataFrame(att_records).dropna(subset=["time_s"])

        if not gps_df.empty:
            gps_df = gps_df.sort_values("time_s").reset_index(drop=True)

            speed_ref_mps = self._gps_speed_reference(gps_df)
            vertical_ref_mps = self._vertical_speed_reference(gps_df)

            spd_scale = self._infer_scale_from_reference(
                gps_df["spd_raw"].to_numpy(dtype=float),
                speed_ref_mps,
                threshold_without_reference=300.0,
            )
            vz_scale = self._infer_scale_from_reference(
                gps_df["vz_raw"].to_numpy(dtype=float),
                vertical_ref_mps,
                threshold_without_reference=60.0,
            )

            gps_df["spd_mps"] = gps_df["spd_raw"] * spd_scale
            gps_df["vz_mps"] = gps_df["vz_raw"] * vz_scale
            gps_df["spd_scale"] = spd_scale
            gps_df["vz_scale"] = vz_scale
            gps_df["sampling_hz"] = sampling_frequency(gps_df["time_s"].to_numpy())

            logger.info(
                "Detected GPS speed scales for {}: spd_scale={}, vz_scale={} (speed_ref_mps={}, vertical_ref_mps={})",
                log_path.name,
                spd_scale,
                vz_scale,
                speed_ref_mps,
                vertical_ref_mps,
            )

        if not imu_df.empty:
            imu_df = imu_df.sort_values("time_s").reset_index(drop=True)
            imu_df["acc_mag_mps2"] = np.sqrt(
                imu_df["acc_x"] ** 2 + imu_df["acc_y"] ** 2 + imu_df["acc_z"] ** 2
            )
            imu_df["sampling_hz"] = sampling_frequency(imu_df["time_s"].to_numpy())

        if not att_df.empty:
            att_df = att_df.sort_values("time_s").reset_index(drop=True)
            att_df["sampling_hz"] = sampling_frequency(att_df["time_s"].to_numpy())

        logger.info(
            "Parsed {} GPS samples, {} IMU samples, and {} ATT samples (gps_hz={}, imu_hz={}, att_hz={})",
            len(gps_df),
            len(imu_df),
            len(att_df),
            gps_df["sampling_hz"].iloc[0] if not gps_df.empty else None,
            imu_df["sampling_hz"].iloc[0] if not imu_df.empty else None,
            att_df["sampling_hz"].iloc[0] if not att_df.empty else None,
        )
        return gps_df, imu_df, att_df
