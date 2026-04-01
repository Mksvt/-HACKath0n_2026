from pydantic import BaseModel


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


class TrajectoryResponse(BaseModel):
    flight_id: str
    trajectory: list[TrajectoryPoint]
    origin_lat: float
    origin_lon: float
    origin_alt: float
