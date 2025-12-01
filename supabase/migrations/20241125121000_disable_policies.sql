/*
  Migration: 20241125121000_disable_policies.sql
  Description: Disable all RLS policies for tables defined in 20241125120000_initial_schema.sql.
  
  Affected tables:
    - user_settings
    - catalogs
    - prompts
    - prompt_versions
    - tags
    - prompt_tags
    - runs
    - run_events
*/

-- Disable Row Level Security (RLS) on all application tables
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE run_events DISABLE ROW LEVEL SECURITY;


