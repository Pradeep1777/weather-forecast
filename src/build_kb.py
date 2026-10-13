import argparse
import json
import logging
from pathlib import Path

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from rag.chunking import make_chunks
from rag.config import PROJECT_DIR, get_settings
from rag.embedding import embed_chunks

logger = logging.getLogger("build_kb")

CHUNKS_PATH = PROJECT_DIR / "data" / "chunks.json"
EMBEDDINGS_PATH = PROJECT_DIR / "data" / "chunk_embeddings.npy"
SCHEMA_PATH = PROJECT_DIR / "sql" / "001_schema.sql"

UPSERT_DOCUMENT = """
    INSERT INTO weather_rag.documents (doc_id, title, file_name, source_url)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (doc_id) DO UPDATE
    SET title = EXCLUDED.title, file_name = EXCLUDED.file_name, source_url = EXCLUDED.source_url
"""
UPSERT_CHUNK = """
    INSERT INTO weather_rag.chunks
        (chunk_id, doc_id, page_start, page_end, section_title, content, chars, embedding)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (chunk_id) DO UPDATE
    SET doc_id = EXCLUDED.doc_id, page_start = EXCLUDED.page_start, page_end = EXCLUDED.page_end,
        section_title = EXCLUDED.section_title, content = EXCLUDED.content,
        chars = EXCLUDED.chars, embedding = EXCLUDED.embedding
"""


def load_files() -> tuple[list[dict], np.ndarray]:
    if not CHUNKS_PATH.exists() or not EMBEDDINGS_PATH.exists():
        raise FileNotFoundError(f"{CHUNKS_PATH.name} / {EMBEDDINGS_PATH.name} not found. "
                                "Run: python src/build_kb.py --rebuild")
    chunks = json.loads(CHUNKS_PATH.read_text(encoding="utf-8"))
    vectors = np.load(EMBEDDINGS_PATH)
    dims = get_settings().embed_dimensions
    if len(chunks) != len(vectors) or vectors.shape[1] != dims:
        raise ValueError(f"{len(chunks)} chunks but vectors {vectors.shape} (expected ({len(chunks)}, {dims})). "
                         "Run: python src/build_kb.py --rebuild")
    return chunks, vectors


def rebuild_files() -> tuple[list[dict], np.ndarray]:
    """Re-chunk the PDFs; reuse saved vectors for chunks whose text did not change."""
    previous = {}
    try:
        old_chunks, old_vectors = load_files()
        previous = {c["text"]: v for c, v in zip(old_chunks, old_vectors)}
    except (FileNotFoundError, ValueError):
        logger.info("No usable saved embeddings: every chunk will be embedded")

    chunks = make_chunks()
    vectors = embed_chunks(chunks, previous)

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHUNKS_PATH.write_text(json.dumps(chunks, indent=2, ensure_ascii=False), encoding="utf-8")
    np.save(EMBEDDINGS_PATH, vectors)
    logger.info("Saved %s and %s", CHUNKS_PATH.relative_to(PROJECT_DIR), EMBEDDINGS_PATH.relative_to(PROJECT_DIR))
    return chunks, vectors


def load_into_database(chunks: list[dict], vectors: np.ndarray) -> None:
    documents = {c["doc_id"]: (c["doc_id"], c["doc_title"], Path(c["source_url"]).name, c["source_url"])
                 for c in chunks}
    try:
        conn = psycopg.connect(get_settings().database_url, autocommit=True, connect_timeout=5)
    except psycopg.OperationalError as error:
        raise SystemExit(f"Database not reachable ({error}). Start it with: docker compose up -d") from None

    with conn:
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        register_vector(conn)
        with conn.transaction(), conn.cursor() as cur:       # all or nothing
            cur.executemany(UPSERT_DOCUMENT, list(documents.values()))
            cur.executemany(UPSERT_CHUNK, [
                (c["chunk_id"], c["doc_id"], c["page_start"], c["page_end"], c["section_title"],
                 c["text"], c["chars"], v) for c, v in zip(chunks, vectors)])
            cur.execute("DELETE FROM weather_rag.chunks WHERE NOT (chunk_id = ANY(%s))",
                        ([c["chunk_id"] for c in chunks],))
            removed = cur.rowcount
        conn.execute("ANALYZE weather_rag.documents")
        conn.execute("ANALYZE weather_rag.chunks")
        total = conn.execute("SELECT count(*) FROM weather_rag.chunks").fetchone()[0]
    logger.info("Database: %d documents, %d chunks (%d old chunks removed)", len(documents), total, removed)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the RAG knowledge base in pgvector.")
    parser.add_argument("--rebuild", action="store_true",
                        help="re-read the PDFs and re-chunk; embed only new or changed chunks")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for noisy in ("httpx", "google_genai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    chunks, vectors = rebuild_files() if args.rebuild else load_files()
    load_into_database(chunks, vectors)


if __name__ == "__main__":
    main()
