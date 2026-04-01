from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger

from app.core.config import Settings, get_settings
from app.schemas.analysis import AISummaryRequest, AISummaryResponse, AnalysisResponse
from app.schemas.flight import FlightInfo, FlightUploadResponse
from app.schemas.metrics import FlightMetrics
from app.schemas.telemetry import TelemetryPoint, TelemetryResponse, TrajectoryResponse
from app.services.ai.summarizer import SimpleAISummarizer
from app.services.analytics.metrics_calculator import MetricsCalculator
from app.services.log_parser.ardupilot_parser import ArdupilotLogParser
from app.services.telemetry.store import FlightData, InMemoryFlightStore
from app.services.telemetry.trajectory import TrajectoryBuilder

api_router = APIRouter()
parser = ArdupilotLogParser()
flight_store = InMemoryFlightStore()
summarizer = SimpleAISummarizer()


def get_settings_dep() -> Settings:
    return get_settings()


def _validate_extension(filename: str | None, settings: Settings) -> str:
    if filename is None:
        raise HTTPException(status_code=400, detail="Filename missing on upload")
    suffix = Path(filename).suffix
    if suffix not in settings.allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type {suffix}. Upload .BIN logs.")
    return filename


def _get_flight_or_404(flight_id: str) -> FlightData:
    flight = flight_store.get(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight


@api_router.post("/flights/upload", response_model=FlightUploadResponse)
async def upload_flight(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings_dep),
) -> FlightUploadResponse:
    filename = _validate_extension(file.filename, settings)

    flight_id = str(uuid4())
    suffix = Path(filename).suffix
    dest = settings.upload_dir / f"{flight_id}{suffix}"

    content = await file.read()
    with open(dest, "wb") as out:
        out.write(content)
    logger.info("Saved uploaded log to {} ({} bytes)", dest, len(content))

    gps_df, imu_df = parser.parse(dest)
    if gps_df.empty:
        raise HTTPException(status_code=400, detail="No GPS samples found in log. Cannot proceed.")

    telemetry_df = MetricsCalculator.compute_telemetry(gps_df, imu_df)
    telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)
    metrics = MetricsCalculator.compute_metrics(telemetry_df)

    origin = telemetry_df.iloc[0]
    flight_store.add(
        FlightData(
            flight_id=flight_id,
            filename=filename,
            uploaded_path=dest,
            gps_df=gps_df,
            imu_df=imu_df,
            origin_lat=float(origin["latitude"]),
            origin_lon=float(origin["longitude"]),
            origin_alt=float(origin["altitude_m"]),
            telemetry_df=telemetry_df,
            trajectory_df=telemetry_df[["enu_x", "enu_y", "enu_z", "speed_mps"]],
            metrics=metrics,
        )
    )

    return FlightUploadResponse(
        flight_id=flight_id,
        filename=filename,
        uploaded_at=datetime.utcnow(),
    )


@api_router.get("/flights/{flight_id}", response_model=FlightInfo)
def get_flight(flight_id: str) -> FlightInfo:
    flight = _get_flight_or_404(flight_id)
    return FlightInfo(
        flight_id=flight.flight_id,
        filename=flight.filename,
        uploaded_at=datetime.utcfromtimestamp(flight.uploaded_path.stat().st_mtime),
        origin_lat=flight.origin_lat,
        origin_lon=flight.origin_lon,
        origin_alt=flight.origin_alt,
    )


@api_router.get("/flights/{flight_id}/telemetry", response_model=TelemetryResponse)
def get_telemetry(flight_id: str) -> TelemetryResponse:
    flight = _get_flight_or_404(flight_id)
    telemetry = flight.telemetry_df
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Telemetry not computed")
    telemetry_safe = telemetry.copy()
    if "acc_mag_mps2" not in telemetry_safe.columns:
        telemetry_safe["acc_mag_mps2"] = None

    telemetry_points = [
        TelemetryPoint(**row)
        for row in telemetry_safe[
            [
                "time_s",
                "latitude",
                "longitude",
                "altitude_m",
                "enu_x",
                "enu_y",
                "enu_z",
                "speed_mps",
                "vertical_speed_mps",
                "acc_mag_mps2",
            ]
        ]
        .rename(columns={"time_s": "timestamp", "acc_mag_mps2": "acceleration_mps2"})
        .to_dict(orient="records")
    ]

    return TelemetryResponse(flight_id=flight_id, telemetry=telemetry_points)


@api_router.get("/flights/{flight_id}/metrics", response_model=FlightMetrics)
def get_metrics(flight_id: str) -> FlightMetrics:
    flight = _get_flight_or_404(flight_id)
    if not flight.metrics:
        raise HTTPException(status_code=404, detail="Metrics not computed")
    return flight.metrics


@api_router.get("/flights/{flight_id}/trajectory", response_model=TrajectoryResponse)
def get_trajectory(flight_id: str) -> TrajectoryResponse:
    flight = _get_flight_or_404(flight_id)
    telemetry = flight.telemetry_df
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Telemetry not computed")
    trajectory_points = TrajectoryBuilder.color_by_speed(telemetry)
    return TrajectoryResponse(
        flight_id=flight_id,
        trajectory=trajectory_points,
        origin_lat=flight.origin_lat or telemetry.iloc[0]["latitude"],
        origin_lon=flight.origin_lon or telemetry.iloc[0]["longitude"],
        origin_alt=flight.origin_alt or telemetry.iloc[0]["altitude_m"],
    )


@api_router.get("/flights/{flight_id}/analysis", response_model=AnalysisResponse)
def analyze(flight_id: str) -> AnalysisResponse:
    flight = _get_flight_or_404(flight_id)
    telemetry = flight.telemetry_df
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Telemetry not computed")

    notes: list[str] = []
    if telemetry["vertical_speed_mps"].abs().max() > 10:
        notes.append("Detected aggressive climb/descent (|vz| > 10 m/s).")
    if telemetry.get("acc_mag_mps2") is not None and telemetry["acc_mag_mps2"].max() > 25:
        notes.append("Acceleration spike > 25 m/s^2 observed.")
    if telemetry["speed_mps"].isna().sum() > len(telemetry) * 0.2:
        notes.append("Large portion of speed samples missing; GPS dropout suspected.")
    if not notes:
        notes.append("No obvious anomalies detected with current heuristics.")

    return AnalysisResponse(flight_id=flight_id, notes=notes)


@api_router.post("/flights/{flight_id}/ai-summary", response_model=AISummaryResponse)
def ai_summary(flight_id: str, body: AISummaryRequest) -> AISummaryResponse:
    flight = _get_flight_or_404(flight_id)
    if not flight.metrics:
        raise HTTPException(status_code=404, detail="Metrics not computed")
    summary_text = summarizer.summarize(flight_id, flight.metrics, prompt=body.prompt)
    return AISummaryResponse(flight_id=flight_id, summary=summary_text, metrics=flight.metrics)
