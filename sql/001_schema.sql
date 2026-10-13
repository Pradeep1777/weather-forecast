-- Weather RAG schema: IMD reference documents, their chunks, and the chunk embeddings.
-- Safe to run many times (IF NOT EXISTS everywhere).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS weather_rag;

-- One row per source document (PDF)
CREATE TABLE IF NOT EXISTS weather_rag.documents (
    doc_id      text PRIMARY KEY,              -- e.g. 'heat_faq'
    title       text NOT NULL,                 -- e.g. 'IMD: FAQ on Heat Wave'
    file_name   text NOT NULL,
    source_url  text NOT NULL
);

-- One row per chunk, with its embedding
CREATE TABLE IF NOT EXISTS weather_rag.chunks (
    chunk_id       text PRIMARY KEY,           -- e.g. 'heat_faq-003'
    doc_id         text NOT NULL REFERENCES weather_rag.documents (doc_id) ON DELETE CASCADE,
    page_start     int  NOT NULL,
    page_end       int  NOT NULL,
    section_title  text NOT NULL,
    content        text NOT NULL,
    chars          int  NOT NULL,
    embedding      vector(768) NOT NULL,       -- gemini-embedding-001, 768 dims, normalised
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (page_end >= page_start)
);

-- Approximate nearest-neighbour index for cosine distance (<=>).
-- The operator class (vector_cosine_ops) must match the operator used in queries.
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
    ON weather_rag.chunks USING hnsw (embedding vector_cosine_ops);

-- Normal index for filtering by document
CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON weather_rag.chunks (doc_id);
