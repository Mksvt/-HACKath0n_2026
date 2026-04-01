from pydantic import BaseModel


class FlightMetrics(BaseModel):
    total_duration_sec: float
    max_horizontal_speed_mps: float
    max_vertical_speed_mps: float
    max_acceleration_mps2: float
    max_altitude_gain_m: float
    total_distance_m: float
