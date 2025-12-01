/*
  Migration: 20241125120000_initial_schema.sql
  Description: Initial schema setup for Promptana, including user settings, catalogs, prompts, versions, runs, and events.
  
  Tables:
    - user_settings
    - catalogs
    - prompts
    - prompt_versions
    - tags
    - prompt_tags
    - runs
    - run_events
    
  Enums:
    - run_status
    - retention_policy
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enums
CREATE TYPE run_status AS ENUM ('pending', 'success', 'error', 'timeout');
CREATE TYPE retention_policy AS ENUM ('fourteen_days', 'thirty_days', 'always');

-- 2. Tables

-- 2.1 user_settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  retention_policy retention_policy NOT NULL DEFAULT 'thirty_days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_settings IS 'User specific settings like retention policy';

-- 2.2 catalogs
CREATE TABLE catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE catalogs IS 'Collections of prompts';
-- Unique index created later

-- 2.3 prompts
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_version_id UUID, -- FK added later
  last_run_id UUID,        -- FK added later
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE prompts IS 'Main prompt entity';

-- 2.4 prompt_versions
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 100000),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 1000),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE prompt_versions IS 'Immutable versions of prompts';

-- Add FK from prompts to prompt_versions
ALTER TABLE prompts 
  ADD CONSTRAINT fk_prompts_current_version 
  FOREIGN KEY (current_version_id) 
  REFERENCES prompt_versions(id) 
  ON DELETE SET NULL;

-- 2.5 tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE tags IS 'Tags for organizing prompts';

-- 2.6 prompt_tags
CREATE TABLE prompt_tags (
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, tag_id)
);
COMMENT ON TABLE prompt_tags IS 'Many-to-many relationship between prompts and tags';

-- 2.7 runs
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  status run_status NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  model_metadata JSONB,
  token_usage JSONB CHECK (jsonb_typeof(token_usage) = 'object' OR token_usage IS NULL),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  error_message TEXT,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE runs IS 'Execution history of prompts';

-- Add FK from prompts to runs
ALTER TABLE prompts 
  ADD CONSTRAINT fk_prompts_last_run 
  FOREIGN KEY (last_run_id) 
  REFERENCES runs(id) 
  ON DELETE SET NULL;

-- 2.8 run_events
CREATE TABLE run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('run','improve','improve_saved','delete','restore')),
  payload JSONB,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE run_events IS 'KPI and analytics events';

-- 3. Indexes

CREATE UNIQUE INDEX catalogs_user_name_idx ON catalogs (user_id, lower(name));
CREATE INDEX prompts_user_updated_idx ON prompts (user_id, updated_at DESC);
CREATE INDEX prompts_search_vector_idx ON prompts USING GIN (search_vector);
CREATE INDEX prompts_catalog_idx ON prompts (catalog_id);
CREATE INDEX prompt_versions_user_created_idx ON prompt_versions (user_id, created_at DESC);
CREATE UNIQUE INDEX tags_user_name_idx ON tags (user_id, lower(name));
CREATE INDEX prompt_tags_tag_idx ON prompt_tags (tag_id);
CREATE INDEX runs_prompt_created_idx ON runs (prompt_id, created_at DESC);
CREATE INDEX runs_user_created_idx ON runs (user_id, created_at DESC);
CREATE INDEX run_events_user_created_idx ON run_events (user_id, created_at DESC);

-- 4. Row Level Security (RLS)

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_events ENABLE ROW LEVEL SECURITY;

-- 4.1 Policies for user_settings
CREATE POLICY "Users can select own settings" ON user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own settings" ON user_settings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.2 Policies for catalogs
CREATE POLICY "Users can select own catalogs" ON catalogs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own catalogs" ON catalogs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own catalogs" ON catalogs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own catalogs" ON catalogs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.3 Policies for prompts
CREATE POLICY "Users can select own prompts" ON prompts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own prompts" ON prompts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own prompts" ON prompts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own prompts" ON prompts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.4 Policies for prompt_versions
CREATE POLICY "Users can select own prompt versions" ON prompt_versions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own prompt versions" ON prompt_versions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own prompt versions" ON prompt_versions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own prompt versions" ON prompt_versions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.5 Policies for tags
CREATE POLICY "Users can select own tags" ON tags FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.6 Policies for prompt_tags
CREATE POLICY "Users can select own prompt tags" ON prompt_tags FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own prompt tags" ON prompt_tags FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own prompt tags" ON prompt_tags FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own prompt tags" ON prompt_tags FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.7 Policies for runs
CREATE POLICY "Users can select own runs" ON runs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own runs" ON runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own runs" ON runs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own runs" ON runs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4.8 Policies for run_events
CREATE POLICY "Users can select own run events" ON run_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own run events" ON run_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own run events" ON run_events FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own run events" ON run_events FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Triggers and Functions

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_catalogs_updated_at
BEFORE UPDATE ON catalogs
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_prompts_updated_at
BEFORE UPDATE ON prompts
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Search vector trigger function
CREATE OR REPLACE FUNCTION refresh_prompt_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  catalog_name TEXT := '';
  version_content TEXT := '';
BEGIN
  -- Get catalog name if exists
  IF NEW.catalog_id IS NOT NULL THEN
    SELECT name INTO catalog_name FROM catalogs WHERE id = NEW.catalog_id;
  END IF;

  -- Get prompt version content if exists
  IF NEW.current_version_id IS NOT NULL THEN
    SELECT content INTO version_content FROM prompt_versions WHERE id = NEW.current_version_id;
  END IF;

  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(catalog_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(version_content, '')), 'C');
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompts_search_vector_update
BEFORE INSERT OR UPDATE ON prompts
FOR EACH ROW EXECUTE FUNCTION refresh_prompt_search_vector();

-- Data guard for prompt_tags
CREATE OR REPLACE FUNCTION check_prompt_tag_ownership()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user owns the prompt
  IF NOT EXISTS (SELECT 1 FROM prompts WHERE id = NEW.prompt_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Prompt does not belong to user';
  END IF;
  
  -- Check if user owns the tag
  IF NOT EXISTS (SELECT 1 FROM tags WHERE id = NEW.tag_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Tag does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_tags_ownership_check
BEFORE INSERT ON prompt_tags
FOR EACH ROW EXECUTE FUNCTION check_prompt_tag_ownership();


