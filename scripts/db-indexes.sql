-- Indexes Prisma cannot express in schema.prisma.
-- Run with: npm run db:vector-index
-- NOTE: `prisma db push` may drop indexes it doesn't know about — re-run
-- this script after any schema push.

-- Approximate nearest-neighbour index for RAG retrieval
-- (the AI assistant orders by cosine distance: embedding <=> query)
CREATE INDEX IF NOT EXISTS resource_documents_embedding_hnsw_idx
  ON resource_documents
  USING hnsw (embedding vector_cosine_ops);
