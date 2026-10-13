import logging
import time

from google.genai import errors, types
from pydantic import BaseModel, Field

from .config import get_settings
from .retrieval import RETRYABLE, ServiceUnavailable, get_client

logger = logging.getLogger(__name__)

SYSTEM_RULES = """You are a weather information assistant for operations staff in India.
Answer using ONLY the information in the CONTEXT. Never use your own knowledge.

Rules:
1. If the CONTEXT does not contain the answer, set "found" to false and say briefly that the IMD documents do not cover it.
2. If it does, set "found" to true and answer in 1-4 short, plain sentences. Keep numbers and units exactly as written.
3. Put the chunk id of every chunk you used in "sources", e.g. ["heat_faq-004"]. Only use ids that appear in the CONTEXT.
4. Do not add advice, warnings or facts that are not in the CONTEXT."""


class GroundedAnswer(BaseModel):
    found: bool = Field(description="True only if the CONTEXT contains the answer")
    answer: str = Field(description="The answer, or a short note that the documents do not cover it")
    sources: list[str] = Field(description="Chunk ids from the CONTEXT that the answer is based on")


def build_prompt(question: str, hits: list[dict]) -> str:
    blocks = []
    for h in hits:
        pages = f"p.{h['page_start']}" if h["page_start"] == h["page_end"] else f"pp.{h['page_start']}-{h['page_end']}"
        blocks.append(f"[{h['chunk_id']}] ({h['doc_title']}, {pages})\n{h['content']}")
    return "CONTEXT:\n" + "\n\n---\n\n".join(blocks) + f"\n\nQUESTION: {question}"


def generate(prompt: str) -> tuple[GroundedAnswer, str]:
    """Return (answer, model used). Tries each chat model in turn; retries temporary errors."""
    settings = get_settings()
    last_error: Exception | None = None
    for model in settings.chat_models:
        for attempt in range(1, settings.retries + 1):
            try:
                response = get_client().models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_RULES,
                        temperature=settings.temperature,
                        response_mime_type="application/json",
                        response_schema=GroundedAnswer,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    ),
                )
                if response.parsed is None:
                    raise ValueError(f"reply was not valid JSON: {(response.text or '')[:200]!r}")
                return response.parsed, model
            except errors.APIError as error:
                last_error = error
                if error.code in RETRYABLE and attempt < settings.retries:
                    logger.warning("%s: error %s, retry %d/%d", model, error.code, attempt, settings.retries)
                    time.sleep(5 * attempt)
                    continue
                logger.warning("%s failed (%s), trying the next model", model, error.code)
                break
            except ValueError as error:
                # a broken reply (e.g. JSON full of "\u0000") is usually a one-off glitch: ask the same model again
                last_error = error
                logger.warning("%s: %s (attempt %d/%d)", model, error, attempt, settings.retries)
                continue
    logger.error("All chat models failed: %s", last_error)
    raise ServiceUnavailable("The answer service is not available right now.") from last_error
