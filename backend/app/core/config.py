from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "UAV Telemetry Analysis API"
    upload_dir: Path = Field(default=Path(__file__).resolve().parent.parent.parent / "data" / "uploads")
    processed_dir: Path = Field(default=Path(__file__).resolve().parent.parent.parent / "data" / "processed")
    allowed_extensions: tuple[str, ...] = (".bin", ".BIN")
    gps_outlier_max_segment_m: float = Field(default=1000.0, gt=0)
    gps_outlier_max_speed_mps: float = Field(default=120.0, gt=0)

    class Config:
        env_file = ".env"


def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    return settings
