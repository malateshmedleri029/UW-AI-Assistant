from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    google_api_key: str = ""
    app_name: str = "UW Smart AI Assistant"
    cors_origins: list[str] = ["http://localhost:4200"]
    session_db_url: str = "sqlite:///./sessions.db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
