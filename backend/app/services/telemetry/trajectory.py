from __future__ import annotations

import numpy as np
import pandas as pd

from app.schemas.telemetry import TrajectoryPoint
from app.utils.geo import wgs84_to_enu


class TrajectoryBuilder:
    @staticmethod
    def to_enu(telemetry: pd.DataFrame) -> pd.DataFrame:
        if telemetry.empty:
            return telemetry

        origin = telemetry.iloc[0]
        east, north, up = wgs84_to_enu(
            telemetry["latitude"].to_numpy(),
            telemetry["longitude"].to_numpy(),
            telemetry["altitude_m"].to_numpy(),
            origin_lat=float(origin["latitude"]),
            origin_lon=float(origin["longitude"]),
            origin_alt=float(origin["altitude_m"]),
        )
        telemetry = telemetry.copy()
        telemetry["enu_x"] = east
        telemetry["enu_y"] = north
        telemetry["enu_z"] = up
        return telemetry

    @staticmethod
    def color_by_speed(telemetry: pd.DataFrame) -> list[TrajectoryPoint]:
        if telemetry.empty:
            return []
        speeds = telemetry["speed_mps"].fillna(0).to_numpy()
        if len(speeds) == 0:
            speeds = np.zeros(len(telemetry))
        max_speed = speeds.max() if speeds.size else 1.0
        colors = [TrajectoryBuilder._speed_to_color(v, max_speed) for v in speeds]

        return [
            TrajectoryPoint(
                x=float(row["enu_x"]),
                y=float(row["enu_y"]),
                z=float(row["enu_z"]),
                color=color,
            )
            for row, color in zip(telemetry.to_dict(orient="records"), colors)
        ]

    @staticmethod
    def _speed_to_color(speed: float, max_speed: float) -> str:
        if max_speed <= 0:
            return "#1d4ed8"
        ratio = min(speed / max_speed, 1.0)
        # Simple blue (slow) to red (fast) gradient
        r = int(29 + ratio * (220 - 29))
        g = int(78 + (1 - ratio) * (255 - 78))
        b = int(216 + (1 - ratio) * (20))
        return f"#{r:02x}{g:02x}{b:02x}"
