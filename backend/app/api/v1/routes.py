from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger

from app.config import Settings, get_settings
from app.schemas.analysis import AISummaryResponse, AnalysisResponse
from app.schemas.flight import FlightInfo, FlightUploadResponse
from app.schemas.metrics import FlightMetrics
from app.schemas.telemetry import (
    SensorStreamMetadata,
    TelemetryMetadata,
    TelemetryPoint,
    TelemetryResponse,
    TrajectoryResponse,
)
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


def _sampling_hz_or_none(df) -> float | None:
    if df is None or df.empty or "sampling_hz" not in df.columns:
        return None
    values = df["sampling_hz"].dropna()
    if values.empty:
        return None
    return float(values.iloc[0])


def _column_value_or_none(df, column: str) -> float | None:
    if df is None or df.empty or column not in df.columns:
        return None
    values = df[column].dropna()
    if values.empty:
        return None
    return float(values.iloc[0])


def _build_telemetry_metadata(flight: FlightData) -> TelemetryMetadata:
    gps_normalization: dict[str, float] = {}
    if flight.gps_speed_scale is not None:
        gps_normalization["speed_scale"] = float(flight.gps_speed_scale)
    if flight.gps_vertical_speed_scale is not None:
        gps_normalization["vertical_speed_scale"] = float(flight.gps_vertical_speed_scale)

    gps_meta = SensorStreamMetadata(
        samples=len(flight.gps_df),
        raw_samples=len(flight.gps_df) + int(flight.gps_outliers_removed),
        dropped_samples=int(flight.gps_outliers_removed),
        sampling_hz=_sampling_hz_or_none(flight.gps_df),
        units={
            "latitude": "deg",
            "longitude": "deg",
            "altitude_m": "m",
            "speed_mps": "m/s",
            "vertical_speed_mps": "m/s",
            "time_s": "s",
        },
        normalization=gps_normalization,
    )

    imu_meta = SensorStreamMetadata(
        samples=len(flight.imu_df),
        sampling_hz=_sampling_hz_or_none(flight.imu_df),
        units={
            "acc_x": "m/s^2",
            "acc_y": "m/s^2",
            "acc_z": "m/s^2",
            "acc_mag_mps2": "m/s^2",
            "time_s": "s",
        },
    )

    att_meta = None
    if flight.att_df is not None and not flight.att_df.empty:
        att_meta = SensorStreamMetadata(
            samples=len(flight.att_df),
            sampling_hz=_sampling_hz_or_none(flight.att_df),
            units={
                "roll": "deg",
                "pitch": "deg",
                "yaw": "deg",
                "time_s": "s",
            },
        )

    return TelemetryMetadata(gps=gps_meta, imu=imu_meta, att=att_meta)


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

    gps_df, imu_df, att_df = parser.parse(dest)
    raw_gps_samples = len(gps_df)
    gps_df, gps_outliers_removed = MetricsCalculator.filter_gps_outliers(
        gps_df,
        max_segment_m=settings.gps_outlier_max_segment_m,
        max_speed_mps=settings.gps_outlier_max_speed_mps,
    )
    if gps_df.empty:
        raise HTTPException(status_code=400, detail="No GPS samples found in log. Cannot proceed.")

    if gps_outliers_removed > 0:
        logger.warning(
            "Removed {} GPS outlier samples from {} ({} -> {} points, max_segment_m={}, max_speed_mps={})",
            gps_outliers_removed,
            filename,
            raw_gps_samples,
            len(gps_df),
            settings.gps_outlier_max_segment_m,
            settings.gps_outlier_max_speed_mps,
        )

    gps_speed_scale = _column_value_or_none(gps_df, "spd_scale")
    gps_vertical_speed_scale = _column_value_or_none(gps_df, "vz_scale")

    telemetry_df = MetricsCalculator.compute_telemetry(gps_df, imu_df)
    telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)
    metrics = MetricsCalculator.compute_metrics(telemetry_df, imu_df=imu_df)

    origin = telemetry_df.iloc[0]
    flight_store.add(
        FlightData(
            flight_id=flight_id,
            filename=filename,
            uploaded_path=dest,
            gps_df=gps_df,
            imu_df=imu_df,
            att_df=att_df,
            origin_lat=float(origin["latitude"]),
            origin_lon=float(origin["longitude"]),
            origin_alt=float(origin["altitude_m"]),
            gps_outliers_removed=gps_outliers_removed,
            gps_speed_scale=gps_speed_scale,
            gps_vertical_speed_scale=gps_vertical_speed_scale,
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

    return TelemetryResponse(
        flight_id=flight_id,
        telemetry=telemetry_points,
        metadata=_build_telemetry_metadata(flight),
    )


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


@api_router.get("/flights/{flight_id}/trajectory/with-attitude")
def get_trajectory_with_attitude(flight_id: str) -> list[dict[str, float]]:
    """
    Returns the trajectory with drone attitude (roll, pitch, yaw) for 3D visualization.
    This is the endpoint used by the Three.js frontend component.
    """
    flight = _get_flight_or_404(flight_id)
    
    if flight.gps_df is None or flight.gps_df.empty:
        raise HTTPException(status_code=404, detail="GPS data not available")
    if flight.att_df is None or flight.att_df.empty:
        raise HTTPException(status_code=404, detail="Attitude data not available")
    
    gps_df = flight.gps_df
    att_df = flight.att_df
    
    # Convert GPS to ENU
    telemetry_df = gps_df.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})
    telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)

    trajectory = []
    for _, gps_row in telemetry_df.iterrows():
        time = gps_row["time_s"]
        att_row = att_df.iloc[(att_df["time_s"] - time).abs().idxmin()]
        
        trajectory.append({
            "time": float(time),
            "x": float(gps_row["enu_x"]),
            "y": float(gps_row["enu_y"]),
            "z": float(gps_row["enu_z"]),
            "roll": float(att_row["roll"]),
            "pitch": float(att_row["pitch"]),
            "yaw": float(att_row["yaw"]),
        })
    
    return trajectory


@api_router.get("/flights/{flight_id}/analysis", response_model=AnalysisResponse)
def analyze(flight_id: str) -> AnalysisResponse:
    flight = _get_flight_or_404(flight_id)
    telemetry = flight.telemetry_df
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Telemetry not computed")

    notes = summarizer.get_analysis(telemetry)
    return AnalysisResponse(flight_id=flight_id, notes=notes)


@api_router.post("/flights/{flight_id}/ai-summary", response_model=AISummaryResponse)
def ai_summary(flight_id: str) -> AISummaryResponse:
    flight = _get_flight_or_404(flight_id)
    if not flight.metrics:
        raise HTTPException(status_code=404, detail="Metrics not computed")
    summary_text = summarizer.summarize(flight.metrics)
    return AISummaryResponse(flight_id=flight_id, summary=summary_text, metrics=flight.metrics)
