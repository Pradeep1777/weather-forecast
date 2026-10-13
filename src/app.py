import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from agent import run_agent
from rag import ServiceUnavailable
from rag.config import get_settings
from rag.retrieval import database_ok

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
for noisy in ("httpx", "google_genai", "langchain_google_genai"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
logger = logging.getLogger("api")

app = FastAPI(
    title="Weather Intelligence Assistant",
    description="Answers Mumbai weather questions with live data, our forecast model and the IMD documents.",
    version="0.3.0",
)


class AskRequest(BaseModel):
    question: str = Field(..., examples=["At what temperature is a heat wave declared for coastal stations?"])

    @field_validator("question")
    @classmethod
    def check_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The question must not be empty.")
        limit = get_settings().max_question_chars
        if len(value) > limit:
            raise ValueError(f"The question is too long (max {limit} characters).")
        return value


class Source(BaseModel):
    chunk_id: str
    document: str
    pages: str
    url: str


class AskResponse(BaseModel):
    status: str = Field(description="answered | incomplete | invalid_input | error")
    answer: str
    tools_used: list[str] = []
    sources: list[Source] = []
    steps: int | None = None


FRIENDLY_ERRORS = {
    "missing": 'Please send JSON like {"question": "your question"}.',
    "json_invalid": "The request body is not valid JSON.",
    "string_type": "The question must be text.",
}


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    messages = [FRIENDLY_ERRORS.get(e["type"]) or str(e.get("ctx", {}).get("error", e["msg"]))
                for e in exc.errors()]
    logger.info("Invalid request to %s: %s", request.url.path, messages)
    return JSONResponse(status_code=422, content={
        "status": "invalid_input", "answer": " ".join(messages), "tools_used": [], "sources": [],
    })


@app.exception_handler(ServiceUnavailable)
async def service_unavailable(request: Request, exc: ServiceUnavailable):
    return JSONResponse(status_code=503, content={
        "status": "error", "answer": f"{exc} Please try again in a moment.", "tools_used": [], "sources": [],
    })


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logger.exception("Unexpected error on %s", request.url.path)
    return JSONResponse(status_code=500, content={
        "status": "error", "answer": "Something went wrong on our side.", "tools_used": [], "sources": [],
    })


@app.post("/ask", response_model=AskResponse, response_model_exclude_none=True)
def ask_endpoint(body: AskRequest) -> dict:
    result = run_agent(body.question)
    result.pop("messages", None)            # conversation memory is for the terminal chat; the API is one question per call
    logger.info("ask: status=%s tools=%s sources=%d question=%r", result["status"],
                result["tools_used"], len(result["sources"]), body.question[:80])
    return result


@app.get("/health")
def health() -> JSONResponse:
    db = database_ok()
    return JSONResponse(status_code=200 if db else 503,
                        content={"status": "ok" if db else "degraded", "database": db})
