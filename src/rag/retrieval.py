import logging
import time
from functools import lru_cache

import numpy as np
import psycopg
from google import genai
from google.genai import errors, types
from pgvector.psycopg import register_vector

from .config import get_settings

logger = logging.getLogger(__name__)

RETRYABLE = {429, 500, 503}


class ServiceUnavailable(RuntimeError):
    """A service we depend on (Gemini or the database) is not reachable right now."""


@lru_cache
def get_client() -> genai.Client:
    return genai.Client(api_key=get_settings().gemini_api_key)


def embed_question(question: str) -> np.ndarray:
    settings = get_settings()
    for attempt in range(1, settings.retries + 1):
        try:
            result = get_client().models.embed_content(
                model=settings.embed_model,
                contents=[question],
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY", output_dimensionality=settings.embed_dimensions
                ),
            )
            vector = np.array(result.embeddings[0].values, dtype="float32")
            return vector / np.linalg.norm(vector)
        except errors.APIError as error:
            if error.code in RETRYABLE and attempt < settings.retries:
                logger.warning("Embedding error %s, retry %d/%d", error.code, attempt, settings.retries)
                time.sleep(3 * attempt)
                continue
            logger.error("Embedding failed: %s", error)
            raise ServiceUnavailable("The embedding service is not available right now.") from error


SEARCH_SQL = """
    SELECT c.chunk_id, d.title, d.source_url, c.page_start, c.page_end,
           c.section_title, c.content, 1 - (c.embedding <=> %(q)s) AS score
    FROM weather_rag.chunks c
    JOIN weather_rag.documents d USING (doc_id)
    ORDER BY c.embedding <=> %(q)s
    LIMIT %(k)s
"""
COLUMNS = ["chunk_id", "doc_title", "source_url", "page_start", "page_end", "section_title", "content", "score"]


def retrieve(question: str, top_k: int | None = None) -> list[dict]:
    """Return the top_k chunks closest in meaning to the question, best first."""
    settings = get_settings()
    vector = embed_question(question)
    try:
        with psycopg.connect(settings.database_url, connect_timeout=5) as conn:
            register_vector(conn)
            rows = conn.execute(SEARCH_SQL, {"q": vector, "k": top_k or settings.top_k}).fetchall()
    except psycopg.Error as error:
        logger.error("Database search failed: %s", error)
        raise ServiceUnavailable("The document database is not available. Is Docker running?") from error
    return [dict(zip(COLUMNS, row)) for row in rows]


def database_ok() -> bool:
    try:
        with psycopg.connect(get_settings().database_url, connect_timeout=3) as conn:
            return conn.execute("SELECT count(*) FROM weather_rag.chunks").fetchone()[0] > 0
    except psycopg.Error as error:
        logger.warning("Health check: database not reachable: %s", error)
        return False
