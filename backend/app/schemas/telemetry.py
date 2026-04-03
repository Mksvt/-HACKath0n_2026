from __future__ import annotations

from pydantic import BaseModel, Field


class TelemetryPoint(BaseModel):
    timestamp: float
    latitude: float
    longitude: float
    altitude_m: float
    enu_x: float | None = None
    enu_y: float | None = None
    enu_z: float | None = None
    speed_mps: float | None = None
    vertical_speed_mps: float | None = None
    acceleration_mps2: float | None = None


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    z: float
    color: str | None = None


class TelemetryResponse(BaseModel):
    flight_id: str
    telemetry: list[TelemetryPoint]
    metadata: TelemetryMetadata | None = None


class SensorStreamMetadata(BaseModel):
    samples: int
    raw_samples: int | None = None
    dropped_samples: int = 0
    sampling_hz: float | None = None
    units: dict[str, str] = Field(default_factory=dict)
    normalization: dict[str, float] = Field(default_factory=dict)


class TelemetryMetadata(BaseModel):
    gps: SensorStreamMetadata
    imu: SensorStreamMetadata
    att: SensorStreamMetadata | None = None


class TrajectoryResponse(BaseModel):
    flight_id: str
    trajectory: list[TrajectoryPoint]
    origin_lat: float
    origin_lon: float
    origin_alt: float
