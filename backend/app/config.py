from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mock_mode: bool = Field(default=False, alias="MOCK_MODE")

    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_chat_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_CHAT_MODEL")

    app_name: str = "UAV Telemetry Analysis API"
    upload_dir: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "uploads", alias="UPLOAD_DIR")
    processed_dir: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "processed", alias="PROCESSED_DIR")
    allowed_extensions: list[str] = Field(default=[".bin", ".BIN"], alias="ALLOWED_EXTENSIONS")
    gps_outlier_max_segment_m: float = Field(default=1000.0, alias="GPS_OUTLIER_MAX_SEGMENT_M", gt=0)
    gps_outlier_max_speed_mps: float = Field(default=120.0, alias="GPS_OUTLIER_MAX_SPEED_MPS", gt=0)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
