1. **List of tables with columns, data types, and constraints**

### 1.1 `auth.users` (Supabase-managed reference)
- `id UUID PRIMARY KEY`
- `email TEXT UNIQUE NOT NULL`
- `encrypted_password TEXT`
- `created_at timestamptz NOT NULL`
- `confirmed_at timestamptz`
- *Notes*: lives in Supabase `auth` schema; all application tables reference it via `user_id`.

### 1.2 Enums
- `CREATE TYPE run_status AS ENUM ('pending','success','error','timeout');`
- `CREATE TYPE retention_policy AS ENUM ('fourteen_days','thirty_days','always');`

### 1.3 `user_settings`
| column | type | constraints |
| --- | --- | --- |
| `user_id` | UUID | PRIMARY KEY, REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `retention_policy` | `retention_policy` | NOT NULL DEFAULT 'thirty_days' |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.4 `catalogs`
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | NOT NULL, UNIQUE (user_id, lower(name)) |
| `description` | TEXT | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.5 `prompts`
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `catalog_id` | UUID | NULL REFERENCES `catalogs(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `current_version_id` | UUID | NULL REFERENCES `prompt_versions(id)` ON DELETE SET NULL |
| `last_run_id` | UUID | NULL REFERENCES `runs(id)` ON DELETE SET NULL |
| `search_vector` | tsvector | STORED; maintained via trigger |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.6 `prompt_versions`
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `prompt_id` | UUID | NOT NULL REFERENCES `prompts(id)` ON DELETE CASCADE |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `content` | TEXT | NOT NULL, CHECK (char_length(content) <= 100000) |
| `summary` | TEXT | NULL, CHECK (summary IS NULL OR char_length(summary) <= 1000) |
| `created_by` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.7 `tags`
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | NOT NULL, UNIQUE (user_id, lower(name)) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.8 `prompt_tags`
| column | type | constraints |
| --- | --- | --- |
| `prompt_id` | UUID | NOT NULL REFERENCES `prompts(id)` ON DELETE CASCADE |
| `tag_id` | UUID | NOT NULL REFERENCES `tags(id)` ON DELETE CASCADE |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| *primary key* | (`prompt_id`, `tag_id`) |
| *data guard* | trigger ensures `user_id` matches owning prompt/tag |

### 1.9 `runs`
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `prompt_id` | UUID | NOT NULL REFERENCES `prompts(id)` ON DELETE CASCADE |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `model` | TEXT | NOT NULL |
| `status` | `run_status` | NOT NULL |
| `input` | JSONB | NOT NULL |
| `output` | JSONB | NULL |
| `model_metadata` | JSONB | NULL |
| `token_usage` | JSONB | NULL CHECK (jsonb_typeof(token_usage) = 'object' OR token_usage IS NULL) |
| `latency_ms` | INTEGER | CHECK (latency_ms >= 0) |
| `error_message` | TEXT | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

### 1.10 `run_events` (optional KPI logging)
| column | type | constraints |
| --- | --- | --- |
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID | NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `prompt_id` | UUID | NULL REFERENCES `prompts(id)` ON DELETE SET NULL |
| `event_type` | TEXT | NOT NULL CHECK (event_type IN ('run','improve','improve_saved','delete','restore')) |
| `payload` | JSONB | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

2. **Relationships between tables**
- `auth.users 1─∞ {prompts, prompt_versions, runs, tags, catalogs, user_settings, run_events}` via `user_id`.
- `catalogs 1─∞ prompts`; deleting a catalog cascades through prompts and their dependent rows (versions, runs, tags via cascades).
- `prompts 1─∞ prompt_versions` with `prompts.current_version_id` pointing to latest version.
- `prompts 1─∞ runs`; `prompts.last_run_id` references most recent run.
- `tags ∞─∞ prompts` realized with `prompt_tags`.
- `user_settings 1─1 users` storing per-user retention policy.
- `run_events` provide analytics trace linked to users (and optionally prompts).

3. **Indexes**
- `prompts_user_updated_idx` ON `prompts (user_id, updated_at DESC)`.
- `prompts_search_vector_idx` ON `prompts USING GIN (search_vector)`.
- `prompts_catalog_idx` ON `prompts (catalog_id)`.
- `prompt_versions_user_created_idx` ON `prompt_versions (user_id, created_at DESC)`.
- `tags_user_name_idx` UNIQUE ON `(user_id, lower(name))`.
- `prompt_tags_tag_idx` ON `prompt_tags (tag_id)`.
- `runs_prompt_created_idx` ON `runs (prompt_id, created_at DESC)`.
- `runs_user_created_idx` ON `runs (user_id, created_at DESC)`.
- `run_events_user_created_idx` ON `run_events (user_id, created_at DESC)`.

4. **PostgreSQL policies (RLS)**
- Enable RLS on every user-owned table:
  ```sql
  ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
  -- repeat for prompt_versions, catalogs, tags, prompt_tags, runs, user_settings, run_events.
  ```
- Example policy (apply per table with matching semantics):
  ```sql
  CREATE POLICY select_own_prompts ON prompts
    FOR SELECT USING (user_id = auth.uid());

  CREATE POLICY insert_own_prompts ON prompts
    FOR INSERT WITH CHECK (user_id = auth.uid());

  CREATE POLICY update_own_prompts ON prompts
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY delete_own_prompts ON prompts
    FOR DELETE USING (user_id = auth.uid());
  ```
- Grant Supabase `service_role` the ability to bypass RLS for trusted server background jobs (OpenRouter executions, retention pruning) via `ALTER TABLE ... FORCE ROW LEVEL SECURITY` (false) for that role or by using `SECURITY DEFINER` functions executed with elevated privileges.

5. **Additional notes**
- Full-text search: trigger keeps `prompts.search_vector` in sync with `prompts.title`, the latest version content (loaded via `current_version_id`), and associated `catalog.name` (setweight A/B/C). All searches hit GIN index.
- Retention: nightly `pg_cron` job prunes `prompt_versions` whose `created_at` is older than policy defined in `user_settings`; `retention_policy = 'always'` skips pruning.
- Prompt size enforcement: `prompt_versions.content` check constraint guarantees Max 100k chars; validation should also run in Supabase edge functions/UI to fail fast.
- Redis handles daily quota enforcement; Postgres stores only durable artifacts (optional `run_events`) for KPI tracking.
- Deletion flow: deleting a catalog cascades through prompts and dependent tables, so the UI must obtain explicit confirmation before issuing destructive operations; there is no soft-delete/trash layer.

