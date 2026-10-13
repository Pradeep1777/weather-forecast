# The Weather Intelligence Assistant API (FastAPI + LangGraph agent).
# Built and started by docker-compose.yml together with the pgvector database:
#     docker compose up -d --build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first: this layer is cached and only rebuilt when requirements.txt changes
COPY requirements.txt .
RUN pip install -r requirements.txt

# The app, and the small built files it needs (no rebuild, no Gemini calls at start-up)
COPY src/ src/
COPY sql/ sql/
COPY chat.py ./
COPY models/gb_simple_h1.joblib models/
COPY data/chunks.json data/chunk_embeddings.npy data/

# Run as a normal user, not root
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=4)"

# 1) load the knowledge base into pgvector (safe to repeat), 2) start the API
CMD ["sh", "-c", "python src/build_kb.py && exec uvicorn app:app --app-dir src --host 0.0.0.0 --port 8000"]
