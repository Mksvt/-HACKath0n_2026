#!/usr/bin/env python3
"""
Basic script to parse Ardupilot BIN log and extract trajectory with attitude.
Usage: python test_parser.py <path_to_bin_file>
"""

import sys
from pathlib import Path

import pandas as pd

from app.services.log_parser.ardupilot_parser import ArdupilotLogParser
from app.services.telemetry.trajectory import TrajectoryBuilder


def main():
    if len(sys.argv) != 2:
        print("Usage: python test_parser.py <path_to_bin_file>")
        sys.exit(1)

    bin_path = Path(sys.argv[1])
    if not bin_path.exists():
        print(f"File {bin_path} does not exist")
        sys.exit(1)

    parser = ArdupilotLogParser()
    gps_df, imu_df, att_df = parser.parse(bin_path)

    print(f"Parsed {len(gps_df)} GPS points, {len(att_df)} attitude points")

    if gps_df.empty or att_df.empty:
        print("No data to process")
        return

    # Convert GPS to ENU
    telemetry_df = gps_df.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})
    telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)

    # For simplicity, take first 10 GPS points and find closest ATT
    trajectory = []
    for _, gps_row in telemetry_df.head(10).iterrows():
        time = gps_row["time_s"]
        # Find closest ATT by time
        att_row = att_df.iloc[(att_df["time_s"] - time).abs().idxmin()]
        trajectory.append({
            "time": time,
            "x": gps_row["enu_x"],
            "y": gps_row["enu_y"],
            "z": gps_row["enu_z"],
            "roll": att_row["roll"],
            "pitch": att_row["pitch"],
            "yaw": att_row["yaw"]
        })

    import json
    print(json.dumps(trajectory, indent=2))


if __name__ == "__main__":
    main()