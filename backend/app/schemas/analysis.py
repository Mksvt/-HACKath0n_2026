from pydantic import BaseModel

from app.schemas.metrics import FlightMetrics


class AnalysisResponse(BaseModel):
    flight_id: str
    notes: list[str]


class AISummaryRequest(BaseModel):
    prompt: str | None = None


class AISummaryResponse(BaseModel):
    flight_id: str
    summary: str
    metrics: FlightMetrics
