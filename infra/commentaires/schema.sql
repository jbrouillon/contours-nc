-- Base D1 des commentaires de contours.nc.
-- Appliquée par deploy.py ; les instructions sont idempotentes.

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,                -- chemin de l'article, ex. /posts/mon-slug/
  page_title TEXT,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,          -- ISO 8601, UTC
  reply TEXT,                        -- réponse publiée sous le commentaire
  reply_at TEXT
);

CREATE INDEX IF NOT EXISTS comments_page_status
  ON comments (page, status, created_at);

CREATE INDEX IF NOT EXISTS comments_status_created
  ON comments (status, created_at);
