import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_DIR / ".env")


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is missing. Add it to {PROJECT_DIR / '.env'} (see .env.example).")
    return value


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    database_url: str
    embed_model: str = "gemini-embedding-001"
    embed_dimensions: int = 768
    # First model is tried first; the next ones are backups (e.g. when a model is overloaded).
    chat_models: tuple[str, ...] = ("gemini-3.5-flash-lite", "gemini-3.8-flash")
    top_k: int = 3
    min_score: float = 0.6          # below this, nothing relevant was found -> Gemini is not called
    temperature: float = 0.1
    max_question_chars: int = 500
    retries: int = 3


@lru_cache
def get_settings() -> Settings:
    database_url = (
        f"postgresql://{_require('POSTGRES_USER')}:{_require('POSTGRES_PASSWORD')}"
        f"@{os.environ.get('POSTGRES_HOST', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5434')}"
        f"/{_require('POSTGRES_DB')}"
    )
    models = os.environ.get("GEMINI_CHAT_MODELS")
    kwargs = {"chat_models": tuple(m.strip() for m in models.split(",") if m.strip())} if models else {}
    return Settings(gemini_api_key=_require("GEMINI_API_KEY"), database_url=database_url, **kwargs)
