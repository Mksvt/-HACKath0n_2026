from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd  # type: ignore[import-untyped]
from loguru import logger
from pymavlink import mavutil  # type: ignore[import-untyped]

from app.utils.geo import sampling_frequency


class ArdupilotLogParser:
    """Minimal Ardupilot .BIN parser using pymavlink.

    Assumptions documented for clarity:
    - GPS Lat/Lng fields are reported in 1e7 scaled degrees (common in Ardupilot
      logs). We normalize to decimal degrees.
    - GPS Alt is reported in centimeters; we normalize to meters.
    - IMU AccX/Y/Z are treated as m/s^2 (Ardupilot logs store m/s^2). Any bias or
      gravity compensation is left to downstream consumers; a note about IMU
      drift is included elsewhere.
    """

    def parse(self, log_path: Path) -> Tuple[pd.DataFrame, pd.DataFrame]:
        gps_records: list[Dict[str, Any]] = []
        imu_records: list[Dict[str, Any]] = []

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
                time_us = getattr(msg, "TimeUS", None) or getattr(msg, "time_usec", None)
                time_s = float(time_us) / 1_000_000.0 if time_us else None
                gps_records.append(
                    {
                        "time_s": time_s,
                        "lat": float(lat_raw) / 1e7,
                        "lon": float(lon_raw) / 1e7,
                        "alt_m": float(alt_raw) / 100.0,
                        "spd_mps": float(getattr(msg, "Spd", 0.0)) / 100.0,
                        "vz_mps": float(getattr(msg, "VZ", 0.0)) / 100.0,
                    }
                )

            if msg_type.startswith("IMU"):
                time_us = getattr(msg, "TimeUS", None)
                time_s = float(time_us) / 1_000_000.0 if time_us else None
                imu_records.append(
                    {
                        "time_s": time_s,
                        "acc_x": float(getattr(msg, "AccX", 0.0)),
                        "acc_y": float(getattr(msg, "AccY", 0.0)),
                        "acc_z": float(getattr(msg, "AccZ", 0.0)),
                    }
                )

        gps_df = pd.DataFrame(gps_records).dropna(subset=["lat", "lon", "alt_m", "time_s"])
        imu_df = pd.DataFrame(imu_records).dropna(subset=["time_s"])

        if not gps_df.empty:
            gps_df = gps_df.sort_values("time_s").reset_index(drop=True)
            gps_df["sampling_hz"] = sampling_frequency(gps_df["time_s"].to_numpy())

        if not imu_df.empty:
            imu_df = imu_df.sort_values("time_s").reset_index(drop=True)
            imu_df["acc_mag_mps2"] = np.sqrt(
                imu_df["acc_x"] ** 2 + imu_df["acc_y"] ** 2 + imu_df["acc_z"] ** 2
            )
            imu_df["sampling_hz"] = sampling_frequency(imu_df["time_s"].to_numpy())

        logger.info(
            "Parsed {} GPS samples and {} IMU samples (gps_hz={}, imu_hz={})",
            len(gps_df),
            len(imu_df),
            gps_df["sampling_hz"].iloc[0] if not gps_df.empty else None,
            imu_df["sampling_hz"].iloc[0] if not imu_df.empty else None,
        )
        return gps_df, imu_df
