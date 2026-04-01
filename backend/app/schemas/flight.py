from datetime import datetime
from pydantic import BaseModel


class FlightUploadResponse(BaseModel):
    flight_id: str
    filename: str
    uploaded_at: datetime


class FlightInfo(BaseModel):
    flight_id: str
    filename: str
    uploaded_at: datetime
    origin_lat: float | None = None
    origin_lon: float | None = None
    origin_alt: float | None = None
