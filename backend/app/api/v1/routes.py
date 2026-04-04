from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

import numpy as np
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
    Attitude is interpolated from the higher-rate ATT stream onto GPS timestamps,
    then smoothed with an exponential moving average to reduce jumpiness.
    """
    flight = _get_flight_or_404(flight_id)

    if flight.gps_df is None or flight.gps_df.empty:
        raise HTTPException(status_code=404, detail="GPS data not available")
    if flight.att_df is None or flight.att_df.empty:
        raise HTTPException(status_code=404, detail="Attitude data not available")

    gps_df = flight.gps_df
    att_df = flight.att_df.sort_values("time_s").reset_index(drop=True)

    telemetry_df = gps_df.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})
    telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)

    att_times = att_df["time_s"].to_numpy(dtype=float)
    att_roll = att_df["roll"].to_numpy(dtype=float)
    att_pitch = att_df["pitch"].to_numpy(dtype=float)
    att_yaw = att_df["yaw"].to_numpy(dtype=float)

    def _interp_angle(times_src: np.ndarray, vals_src: np.ndarray, t: float, wrap: float = 0) -> float:
        """Linear interpolation for an angle series at time *t*.
        If *wrap* > 0 the angle is assumed to wrap at that value (e.g. 360 for yaw)."""
        idx = int(np.searchsorted(times_src, t, side="right"))
        if idx == 0:
            return float(vals_src[0])
        if idx >= len(times_src):
            return float(vals_src[-1])

        t0 = times_src[idx - 1]
        t1 = times_src[idx]
        dt = t1 - t0
        if dt <= 0:
            return float(vals_src[idx])

        frac = (t - t0) / dt
        a = float(vals_src[idx - 1])
        b = float(vals_src[idx])

        if wrap > 0:
            diff = b - a
            if diff > wrap / 2:
                b -= wrap
            elif diff < -wrap / 2:
                b += wrap
            result = a + frac * (b - a)
            return result % wrap
        else:
            return a + frac * (b - a)

    raw_rolls: list[float] = []
    raw_pitches: list[float] = []
    raw_yaws: list[float] = []
    times_out: list[float] = []
    xs: list[float] = []
    ys: list[float] = []
    zs: list[float] = []

    for _, gps_row in telemetry_df.iterrows():
        t = float(gps_row["time_s"])
        times_out.append(t)
        xs.append(float(gps_row["enu_x"]))
        ys.append(float(gps_row["enu_y"]))
        zs.append(float(gps_row["enu_z"]))
        raw_rolls.append(_interp_angle(att_times, att_roll, t))
        raw_pitches.append(_interp_angle(att_times, att_pitch, t))
        raw_yaws.append(_interp_angle(att_times, att_yaw, t, wrap=360))

    def _angle_diff(a: float, b: float, wrap: float = 0) -> float:
        """Shortest signed difference b - a, handling wrapping."""
        d = b - a
        if wrap > 0:
            d = (d + wrap / 2) % wrap - wrap / 2
        return d

    def _ema_smooth(vals: list[float], alpha: float = 0.3, wrap: float = 0,
                    max_rate: float = 0) -> list[float]:
        """EMA with optional angle wrapping and rate limiting (deg per step)."""
        if not vals:
            return vals
        out = [vals[0]]
        for i in range(1, len(vals)):
            prev = out[-1]
            cur = vals[i]
            diff = _angle_diff(prev, cur, wrap)
            if max_rate > 0 and abs(diff) > max_rate:
                diff = max_rate if diff > 0 else -max_rate
            smoothed = prev + alpha * diff
            if wrap > 0:
                smoothed = smoothed % wrap
            out.append(smoothed)
        return out

    dt_gps = 0.2
    max_roll_rate = 60 * dt_gps   # 60°/s max angular velocity
    max_pitch_rate = 60 * dt_gps
    max_yaw_rate = 90 * dt_gps    # yaw can change faster during turns

    sm_rolls = _ema_smooth(raw_rolls, alpha=0.25, max_rate=max_roll_rate)
    sm_pitches = _ema_smooth(raw_pitches, alpha=0.25, max_rate=max_pitch_rate)
    sm_yaws = _ema_smooth(raw_yaws, alpha=0.25, wrap=360, max_rate=max_yaw_rate)

    trajectory = [
        {
            "time": times_out[i],
            "x": xs[i],
            "y": ys[i],
            "z": zs[i],
            "roll": round(sm_rolls[i], 4),
            "pitch": round(sm_pitches[i], 4),
            "yaw": round(sm_yaws[i], 4),
        }
        for i in range(len(times_out))
    ]

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
