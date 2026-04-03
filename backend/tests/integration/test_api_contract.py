from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


def _find_sample_bin() -> Path | None:
    backend_root = Path(__file__).resolve().parents[2]
    uploads_dir = backend_root / "data" / "uploads"
    if not uploads_dir.exists():
        return None

    bin_files = sorted(uploads_dir.glob("*.BIN"))
    if not bin_files:
        return None
    return bin_files[0]


@pytest.fixture(scope="module")
def sample_bin_path() -> Path:
    path = _find_sample_bin()
    if path is None:
        pytest.skip("No .BIN file found in backend/data/uploads")
    return path


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def uploaded_flight_id(client: TestClient, sample_bin_path: Path) -> Iterator[str]:
    with sample_bin_path.open("rb") as file_handle:
        upload_res = client.post(
            "/api/v1/flights/upload",
            files={"file": (sample_bin_path.name, file_handle, "application/octet-stream")},
        )

    assert upload_res.status_code == 200, upload_res.text
    payload = upload_res.json()
    assert payload.get("flight_id")
    flight_id = str(payload["flight_id"])

    yield flight_id

    generated_upload = sample_bin_path.parent / f"{flight_id}.BIN"
    if generated_upload.exists():
        generated_upload.unlink()


def test_telemetry_contract_includes_metadata(client: TestClient, uploaded_flight_id: str) -> None:
    telemetry_res = client.get(f"/api/v1/flights/{uploaded_flight_id}/telemetry")

    assert telemetry_res.status_code == 200, telemetry_res.text
    payload = telemetry_res.json()

    assert payload.get("flight_id") == uploaded_flight_id
    assert isinstance(payload.get("telemetry"), list)
    assert len(payload["telemetry"]) > 0

    metadata = payload.get("metadata")
    assert metadata is not None
    assert metadata["gps"]["samples"] > 0
    assert metadata["gps"]["raw_samples"] >= metadata["gps"]["samples"]
    assert metadata["gps"]["dropped_samples"] >= 0
    assert metadata["imu"]["samples"] >= 0

    gps_hz = metadata["gps"].get("sampling_hz")
    imu_hz = metadata["imu"].get("sampling_hz")
    assert gps_hz is None or gps_hz > 0
    assert imu_hz is None or imu_hz > 0

    assert metadata["gps"]["units"]["latitude"] == "deg"
    assert metadata["gps"]["units"]["longitude"] == "deg"
    assert "speed_scale" in metadata["gps"]["normalization"]
    assert "vertical_speed_scale" in metadata["gps"]["normalization"]
    assert metadata["imu"]["units"]["acc_mag_mps2"] == "m/s^2"

    # Coordinate normalization sanity: parsed values must be valid geodetic ranges.
    for point in payload["telemetry"][:200]:
        assert -90.0 <= point["latitude"] <= 90.0
        assert -180.0 <= point["longitude"] <= 180.0


def test_metrics_and_trajectory_endpoints(client: TestClient, uploaded_flight_id: str) -> None:
    metrics_res = client.get(f"/api/v1/flights/{uploaded_flight_id}/metrics")
    assert metrics_res.status_code == 200, metrics_res.text
    metrics = metrics_res.json()

    assert metrics["total_duration_sec"] >= 0
    assert metrics["total_distance_m"] >= 0
    assert metrics["max_horizontal_speed_mps"] >= 0
    assert metrics["max_vertical_speed_mps"] >= 0
    assert metrics["max_acceleration_mps2"] >= 0

    trajectory_res = client.get(f"/api/v1/flights/{uploaded_flight_id}/trajectory")
    assert trajectory_res.status_code == 200, trajectory_res.text
    trajectory_payload = trajectory_res.json()

    assert isinstance(trajectory_payload.get("trajectory"), list)
    assert len(trajectory_payload["trajectory"]) > 0
    first = trajectory_payload["trajectory"][0]
    assert "x" in first and "y" in first and "z" in first


def test_ai_summary_endpoint_returns_text(client: TestClient, uploaded_flight_id: str) -> None:
    summary_res = client.post(
        f"/api/v1/flights/{uploaded_flight_id}/ai-summary",
        json={"prompt": "Summarize anomalies in 3 bullet points."},
    )

    assert summary_res.status_code == 200, summary_res.text
    payload = summary_res.json()
    assert payload.get("flight_id") == uploaded_flight_id
    assert isinstance(payload.get("summary"), str)
    assert len(payload["summary"].strip()) > 0
