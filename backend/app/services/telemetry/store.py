from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import pandas as pd  # type: ignore[import-untyped]

from app.schemas.metrics import FlightMetrics


@dataclass
class FlightData:
    flight_id: str
    filename: str
    uploaded_path: Path
    gps_df: pd.DataFrame
    imu_df: pd.DataFrame
    origin_lat: float | None
    origin_lon: float | None
    origin_alt: float | None
    metrics: FlightMetrics | None = None
    telemetry_df: pd.DataFrame | None = None
    trajectory_df: pd.DataFrame | None = None


class InMemoryFlightStore:
    def __init__(self) -> None:
        self._store: Dict[str, FlightData] = {}

    def add(self, flight: FlightData) -> None:
        self._store[flight.flight_id] = flight

    def get(self, flight_id: str) -> Optional[FlightData]:
        return self._store.get(flight_id)

    def exists(self, flight_id: str) -> bool:
        return flight_id in self._store

    def all(self) -> Dict[str, FlightData]:
        return self._store
