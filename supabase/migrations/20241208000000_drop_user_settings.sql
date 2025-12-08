/*
  Migration: 20241208000000_drop_user_settings.sql
  Description: Remove user_settings table and retention_policy enum for MVP simplification.
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS set_user_settings_updated_at ON user_settings;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can select own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

-- Drop the table
DROP TABLE IF EXISTS user_settings;

-- Drop the enum type
DROP TYPE IF EXISTS retention_policy;
