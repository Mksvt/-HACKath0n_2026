from pydantic import BaseModel

from app.schemas.metrics import FlightMetrics


class AnalysisResponse(BaseModel):
    flight_id: str
    notes: list[str]


class AISummaryResponse(BaseModel):
    flight_id: str
    summary: str
    metrics: FlightMetrics

#test
