from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mock_mode: bool = Field(default=False, alias="MOCK_MODE")

    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_chat_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_CHAT_MODEL")

    app_name: str = "UAV Telemetry Analysis API"
    upload_dir: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "uploads", alias="UPLOAD_DIR")
    processed_dir: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "processed", alias="PROCESSED_DIR")
    allowed_extensions: list[str] = Field(default=[".bin", ".BIN"], alias="ALLOWED_EXTENSIONS")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY must be set")
    return settings
