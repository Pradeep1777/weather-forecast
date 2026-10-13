import logging

from .config import get_settings
from .generation import build_prompt, generate
from .retrieval import retrieve

logger = logging.getLogger(__name__)

NOT_COVERED = "I don't have information about that in the IMD reference documents."


def ask(question: str) -> dict:
    """
    Answer a question from the IMD documents only.

    status is one of:
      answered       - grounded answer, with sources
      not_covered    - nothing relevant in the documents (score gate, or Gemini found nothing)
      invalid_input  - empty or too long

    Raises ServiceUnavailable if Gemini or the database cannot be reached.
    """
    settings = get_settings()
    question = (question or "").strip()
    if not question:
        return {"status": "invalid_input", "answer": "Please type a question.", "sources": []}
    if len(question) > settings.max_question_chars:
        return {"status": "invalid_input",
                "answer": f"The question is too long (max {settings.max_question_chars} characters).",
                "sources": []}

    hits = retrieve(question)
    best = float(hits[0]["score"]) if hits else 0.0
    if best < settings.min_score:
        logger.info("Best score %.3f < %.2f: not calling Gemini", best, settings.min_score)
        return {"status": "not_covered", "answer": NOT_COVERED, "sources": [], "best_score": round(best, 3)}

    reply, model = generate(build_prompt(question, hits))

    by_id = {h["chunk_id"]: h for h in hits}
    valid = [s for s in dict.fromkeys(reply.sources) if s in by_id]
    invented = [s for s in reply.sources if s not in by_id]
    if invented:
        logger.warning("Gemini cited unknown sources %s - removed", invented)
    if not reply.found or not valid:
        return {"status": "not_covered", "answer": reply.answer if not reply.found else NOT_COVERED,
                "sources": [], "best_score": round(best, 3), "model": model}

    return {
        "status": "answered",
        "answer": reply.answer,
        "sources": [{
            "chunk_id": s,
            "document": by_id[s]["doc_title"],
            "page_start": by_id[s]["page_start"],
            "page_end": by_id[s]["page_end"],
            "url": by_id[s]["source_url"],
            "score": round(float(by_id[s]["score"]), 3),
        } for s in valid],
        "best_score": round(best, 3),
        "model": model,
    }
