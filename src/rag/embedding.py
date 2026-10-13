import logging
import time

import numpy as np
from google.genai import errors, types

from .config import get_settings
from .retrieval import RETRYABLE, ServiceUnavailable, get_client

logger = logging.getLogger(__name__)

BATCH_SIZE = 100  # texts per API call


def normalise(vectors) -> np.ndarray:
    vectors = np.asarray(vectors, dtype="float32")
    return vectors / np.linalg.norm(vectors, axis=-1, keepdims=True)


def embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT", retries: int = 5) -> np.ndarray:
    settings = get_settings()
    vectors = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start:start + BATCH_SIZE]
        for attempt in range(1, retries + 1):
            try:
                result = get_client().models.embed_content(
                    model=settings.embed_model,
                    contents=batch,
                    config=types.EmbedContentConfig(task_type=task_type,
                                                    output_dimensionality=settings.embed_dimensions),
                )
                vectors += [e.values for e in result.embeddings]
                break
            except errors.APIError as error:
                if error.code in RETRYABLE and attempt < retries:
                    wait = 10 * attempt     # free tier: wait for the per-minute quota to refill
                    logger.warning("Embedding error %s, retry %d/%d in %ds", error.code, attempt, retries, wait)
                    time.sleep(wait)
                    continue
                logger.error("Embedding failed: %s", error)
                raise ServiceUnavailable("The embedding service is not available right now.") from error
        logger.info("Embedded %d / %d", min(start + BATCH_SIZE, len(texts)), len(texts))
    return normalise(vectors)


def embed_chunks(chunks: list[dict], previous: dict[str, np.ndarray] | None = None) -> np.ndarray:
    """One vector per chunk. Texts found in `previous` (text -> vector) are reused: no API call."""
    previous = previous or {}
    todo = sorted({c["text"] for c in chunks if c["text"] not in previous})
    logger.info("%d chunks: %d reused, %d to embed", len(chunks), len(chunks) - sum(
        c["text"] not in previous for c in chunks), len(todo))
    fresh = dict(zip(todo, embed_texts(todo))) if todo else {}
    return np.stack([previous.get(c["text"], fresh.get(c["text"])) for c in chunks]).astype("float32")
