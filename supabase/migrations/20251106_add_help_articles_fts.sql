-- Migration: Add locale-aware full-text search for help_articles
-- This fixes the issue where German content is tokenized with wrong stemming rules
-- Updated to use plainto_tsquery() for safer user input handling

-- Create help_articles table if not exists
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  category TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, locale)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_locale ON help_articles(locale);
CREATE INDEX IF NOT EXISTS idx_help_articles_updated_at ON help_articles(updated_at);

-- Add locale-aware search vector column
ALTER TABLE help_articles 
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  CASE locale
    WHEN 'de' THEN to_tsvector('german', title || ' ' || body_markdown)
    WHEN 'en' THEN to_tsvector('english', title || ' ' || body_markdown)
    ELSE to_tsvector('simple', title || ' ' || body_markdown)
  END
) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_help_articles_fts ON help_articles USING gin(search_vector);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_help_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_help_articles_updated_at ON help_articles;
CREATE TRIGGER update_help_articles_updated_at
  BEFORE UPDATE ON help_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_help_articles_updated_at();

-- Enable RLS
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read help articles
CREATE POLICY "Anyone can view help articles" ON help_articles
  FOR SELECT
  USING (true);

-- Policy: Only admins can modify (use service role)
-- No INSERT/UPDATE policies for regular users

-- Function to search help articles with locale-aware FTS
CREATE OR REPLACE FUNCTION search_help_articles(
  search_query TEXT,
  search_locale TEXT DEFAULT 'en',
  search_category TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body_markdown TEXT,
  category TEXT,
  locale TEXT,
  tags TEXT[],
  view_count INTEGER,
  helpful_count INTEGER,
  not_helpful_count INTEGER,
  relevance REAL
) AS $$
DECLARE
  query tsquery;
BEGIN
  -- Build the query based on locale
  CASE search_locale
    WHEN 'de' THEN query := plainto_tsquery('german', search_query);
    WHEN 'en' THEN query := plainto_tsquery('english', search_query);
    ELSE query := plainto_tsquery('simple', search_query);
  END CASE;

  RETURN QUERY
  SELECT
    ha.id,
    ha.title,
    ha.body_markdown,
    ha.category,
    ha.locale,
    ha.tags,
    ha.view_count,
    ha.helpful_count,
    ha.not_helpful_count,
    ts_rank(ha.search_vector, query) AS relevance
  FROM
    help_articles ha
  WHERE
    ha.locale = search_locale
    AND ha.search_vector @@ query
    AND (search_category IS NULL OR ha.category = search_category)
  ORDER BY
    relevance DESC,
    ha.helpful_count DESC,
    ha.view_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE help_articles IS 'Help center articles with locale-aware full-text search';
COMMENT ON COLUMN help_articles.search_vector IS 'Generated tsvector using locale-specific text search configuration for accurate stemming';
COMMENT ON FUNCTION search_help_articles IS 'Search help articles with locale-aware FTS ranking by relevance, helpfulness, and views';
