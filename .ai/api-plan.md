## REST API Plan


### 1. Resources

- **User (`auth.users`)**: Authenticated Supabase user; referenced by `user_id` in all domain tables.
- **Catalogs (`catalogs`)**: Optional grouping for prompts.
- **Prompts (`prompts`)**: Top-level prompt entities with metadata, search vector, links to current version and last run.
- **Prompt versions (`prompt_versions`)**: Version history of prompt content, with summaries and metadata.
- **Tags (`tags`)**: User-defined labels for prompts.
- **Prompt–tag links (`prompt_tags`)**: Many-to-many join between prompts and tags.
- **Runs (`runs`)**: Executions of prompts against OpenRouter, including status, timing, token usage, and results.
- **Run events (`run_events`)**: Higher-level analytics events capturing key user actions (run, improve, improve_saved, delete, restore).
- **Quotas / usage (derived)**: Not a table, but view over `runs`, `run_events`, and Redis counters for daily/monthly limits.


### 2. Endpoints

All endpoints are assumed to be implemented as Next.js API routes under `/api/*`. Unless otherwise noted:

- **Authentication**: Required; request must carry a valid Supabase-authenticated session.
- **Authorization**: User may only access rows with `user_id = auth.uid()`; enforced by Supabase RLS and application-level checks.
- **Content type**: `application/json` for both requests and responses.
- **Errors**: Common error format:

```json
{
  "error": {
    "code": "string",
    "message": "Human-readable message",
    "details": {
      "fieldErrors": {
        "fieldName": ["issue1", "issue2"]
      }
    }
  }
}
```

- **Common error codes**:
  - **400**: `BAD_REQUEST` (validation error, invalid query).
  - **401**: `UNAUTHORIZED` (no valid session).
  - **403**: `FORBIDDEN` (auth ok but RLS or business rule denies access).
  - **404**: `NOT_FOUND` (resource does not exist or not visible to user).
  - **409**: `CONFLICT` (uniqueness violations, duplicate-detection conflicts).
  - **422**: `VALIDATION_FAILED` (payload structurally valid JSON but violates constraints).
  - **429**: `RATE_LIMITED` or `QUOTA_EXCEEDED`.
  - **500**: `INTERNAL_ERROR` (unexpected server failure).


#### 2.1 Authentication and Session

Supabase handles OAuth/email sign-in via its own endpoints and JS client; the application exposes minimal session helpers.

- **Get current user**
  - **Method**: GET  
  - **URL**: `/api/me`
  - **Description**: Return the authenticated user profile; used by the UI to gate access.
  - **Query parameters**: none
  - **Request body**: none
  - **Response 200**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

  - **Success codes**:
    - **200 OK**: Session is valid; user info returned.
  - **Error codes**:
    - **401 UNAUTHORIZED**: No valid Supabase session cookie/token.

- **Sign out**
  - **Method**: POST
  - **URL**: `/api/auth/signout`
  - **Description**: Invalidate current session (wrapper around Supabase sign-out, plus cookie cleanup).
  - **Query parameters**: none
  - **Request body**: none
  - **Response 204**: Empty body.
  - **Success codes**:
    - **204 NO_CONTENT**: Sign-out succeeded.
  - **Error codes**:
    - **401 UNAUTHORIZED**: No active session.
    - **500 INTERNAL_ERROR**: Failed to revoke session.


#### 2.2 Catalogs (`catalogs`)

- **List catalogs**
  - **Method**: GET
  - **URL**: `/api/catalogs`
  - **Description**: List all catalogs for the current user, ordered by `created_at` or name.
  - **Query parameters**:
    - **page** (integer, optional, default `1`)
    - **pageSize** (integer, optional, default `20`, max `100`)
    - **search** (string, optional; filters by case-insensitive substring of name)
  - **Request body**: none
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "LLM Utilities",
      "description": "Prompts for general-purpose tools",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

  - **Success codes**:
    - **200 OK**
  - **Error codes**:
    - **401 UNAUTHORIZED**

- **Create catalog**
  - **Method**: POST
  - **URL**: `/api/catalogs`
  - **Description**: Create a new catalog for the current user.
  - **Request body**:

```json
{
  "name": "My Catalog",
  "description": "Optional description"
}
```

  - **Response 201**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "My Catalog",
  "description": "Optional description",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

  - **Success codes**:
    - **201 CREATED**
  - **Error codes**:
    - **400 BAD_REQUEST**: Missing or malformed fields.
    - **422 VALIDATION_FAILED**: Name empty or too long.
    - **409 CONFLICT**: `(user_id, lower(name))` uniqueness violation.
    - **401 UNAUTHORIZED**

- **Update catalog**
  - **Method**: PATCH
  - **URL**: `/api/catalogs/{catalogId}`
  - **Description**: Update a catalog's name or description.
  - **Request body**:

```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

  - **Response 200**: Same shape as "Create catalog" response.
  - **Success codes**:
    - **200 OK**
  - **Error codes**:
    - **404 NOT_FOUND**: Catalog not found or not owned by user.
    - **409 CONFLICT**: New name violates uniqueness.
    - **422 VALIDATION_FAILED**

- **Delete catalog**
  - **Method**: DELETE
  - **URL**: `/api/catalogs/{catalogId}`
  - **Description**: Delete a catalog. Business logic dictates whether prompts are cascaded (as per DB) or re-assigned/unassigned according to configured UI flow. For this MVP, deletion **unassigns** `catalog_id` from prompts to avoid destructive cascades.
  - **Request body**: none
  - **Response 204**: Empty.
  - **Success codes**:
    - **204 NO_CONTENT**
  - **Error codes**:
    - **404 NOT_FOUND**
    - **409 CONFLICT**: If UI/DB constraints require reassignment but no reassignment provided.


#### 2.3 Tags (`tags`) and Prompt–Tag Links (`prompt_tags`)

- **List tags**
  - **Method**: GET
  - **URL**: `/api/tags`
  - **Description**: List all tags for the current user.
  - **Query parameters**:
    - **page** (integer, optional, default `1`)
    - **pageSize** (integer, optional, default `50`, max `200`)
    - **search** (string, optional; partial case-insensitive name match)
  - **Request body**: none
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "onboarding",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

- **Create tag**
  - **Method**: POST
  - **URL**: `/api/tags`
  - **Description**: Create a new tag for the current user.
  - **Request body**:

```json
{
  "name": "onboarding"
}
```

  - **Response 201**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "onboarding",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

  - **Error codes**:
    - **409 CONFLICT**: `(user_id, lower(name))` already exists.

- **Update tag**
  - **Method**: PATCH
  - **URL**: `/api/tags/{tagId}`
  - **Description**: Rename a tag.
  - **Request body**:

```json
{
  "name": "updated-name"
}
```

  - **Response 200**: Same as create-tag response.

- **Delete tag**
  - **Method**: DELETE
  - **URL**: `/api/tags/{tagId}`
  - **Description**: Delete a tag and disassociate it from all prompts (`prompt_tags` rows deleted).
  - **Request body**: none
  - **Response 204**: Empty.

Prompt–tag associations are primarily managed via the prompt endpoints (see below). Optionally:

- **Replace tags for a prompt**
  - **Method**: PUT
  - **URL**: `/api/prompts/{promptId}/tags`
  - **Description**: Replace the full set of tags for a given prompt by tag IDs.
  - **Request body**:

```json
{
  "tagIds": ["uuid-1", "uuid-2"]
}
```

  - **Response 200**:

```json
{
  "promptId": "uuid",
  "tagIds": ["uuid-1", "uuid-2"]
}
```


#### 2.4 Prompts (`prompts`)

Prompt list and detail must support search, filtering, and last-run preview.

**Prompt representation**

```json
{
  "id": "uuid",
  "title": "Summarize product requirements",
  "catalogId": "uuid-or-null",
  "tags": [
    {
      "id": "uuid",
      "name": "summarization"
    }
  ],
  "currentVersionId": "uuid-or-null",
  "lastRun": {
    "id": "uuid",
    "status": "success",
    "createdAt": "2024-01-02T12:34:00.000Z",
    "model": "openrouter/model",
    "latencyMs": 1234
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

- **List prompts**
  - **Method**: GET
  - **URL**: `/api/prompts`
  - **Description**: List prompts with filtering and sorting; includes limited details and last run summary.
  - **Query parameters**:
    - **page** (integer, default `1`)
    - **pageSize** (integer, default `20`, max `100`)
    - **search** (string, optional; full-text search against `prompts.search_vector`)
    - **tagIds** (comma-separated UUIDs, optional)
    - **catalogId** (UUID, optional)
    - **sort** (string, optional; allowed: `updatedAtDesc` (default), `createdAtDesc`, `titleAsc`, `lastRunDesc`, `relevance`)
  - **Request body**: none
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Summarize product requirements",
      "catalogId": "uuid-or-null",
      "tags": [
        { "id": "uuid", "name": "summarization" }
      ],
      "currentVersionId": "uuid-or-null",
      "lastRun": {
        "id": "uuid",
        "status": "success",
        "createdAt": "2024-01-02T12:34:00.000Z"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

- **Create prompt**
  - **Method**: POST
  - **URL**: `/api/prompts`
  - **Description**: Create a new prompt, optionally with initial content, tags, and catalog. This creates both a `prompts` row and a first `prompt_versions` row.
  - **Request body**:

```json
{
  "title": "Summarize PRD",
  "content": "You are a helpful assistant...",
  "catalogId": "uuid-or-null",
  "tagIds": ["uuid-1", "uuid-2"],
  "summary": "Initial version"
}
```

  - **Behavior and business rules**:
    - Validate `title` non-empty and length-limited.
    - Validate `content` length `<= 100000` characters.
    - Optionally run **duplicate detection** against existing prompts (similar title/content) and return a warning flag.
  - **Response 201**:

```json
{
  "prompt": {
    "id": "uuid",
    "title": "Summarize PRD",
    "catalogId": "uuid-or-null",
    "tags": [
      { "id": "uuid-1", "name": "summarization" }
    ],
    "currentVersionId": "uuid-version",
    "lastRun": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "version": {
    "id": "uuid-version",
    "title": "Summarize PRD",
    "content": "You are a helpful assistant...",
    "summary": "Initial version",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "duplicateWarning": {
    "similarPromptIds": ["uuid-other"],
    "confidence": 0.8
  }
}
```

  - **Error codes**:
    - **422 VALIDATION_FAILED**: Content exceeds max length, invalid tags/catalog.

- **Get prompt detail**
  - **Method**: GET
  - **URL**: `/api/prompts/{promptId}`
  - **Description**: Return full prompt metadata, current content, last run summary, and basic version info.
  - **Query parameters**:
    - **includeVersions** (boolean, default `false`; if `true`, include recent versions stub list)
    - **includeRuns** (boolean, default `false`; if `true`, include recent runs stub list)
  - **Response 200**:

```json
{
  "id": "uuid",
  "title": "Summarize PRD",
  "catalogId": "uuid-or-null",
  "tags": [
    { "id": "uuid", "name": "summarization" }
  ],
  "currentVersion": {
    "id": "uuid-version",
    "title": "Summarize PRD",
    "content": "You are a helpful assistant...",
    "summary": "Initial version",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "lastRun": {
    "id": "uuid-run",
    "status": "success",
    "createdAt": "2024-01-02T12:34:00.000Z",
    "model": "openrouter/model",
    "latencyMs": 1200
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z",
  "versions": [
    {
      "id": "uuid-version",
      "summary": "Initial version",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "runs": [
    {
      "id": "uuid-run",
      "status": "success",
      "createdAt": "2024-01-02T12:34:00.000Z"
    }
  ]
}
```

- **Update prompt metadata (non-content)**
  - **Method**: PATCH
  - **URL**: `/api/prompts/{promptId}`
  - **Description**: Update prompt title, catalog, or tags without creating a new content version.
  - **Request body**:

```json
{
  "title": "Updated title",
  "catalogId": "uuid-or-null",
  "tagIds": ["uuid-1", "uuid-2"]
}
```

  - **Response 200**: Updated prompt object (same structure as "Get prompt detail" but without versions/runs unless requested).

- **Delete prompt**
  - **Method**: DELETE
  - **URL**: `/api/prompts/{promptId}`
  - **Description**: Permanently delete a prompt, all its versions, runs, prompt_tags, and associated run_events. Requires explicit confirmation in the UI; API assumes confirmation already obtained.
  - **Request body** (optional confirmation guard):

```json
{
  "confirm": true
}
```

  - **Response 204**: Empty.
  - **Business logic**:
    - Delete cascades through dependent tables as per DB constraints.
    - Log a `run_events` entry with `event_type = "delete"`.


#### 2.5 Prompt Versions (`prompt_versions`)

**Version representation**

```json
{
  "id": "uuid",
  "promptId": "uuid",
  "title": "Summarize PRD",
  "content": "Prompt content...",
  "summary": "What changed in this version",
  "createdBy": "uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

- **List versions for a prompt**
  - **Method**: GET
  - **URL**: `/api/prompts/{promptId}/versions`
  - **Description**: Paginated list of versions for a prompt, ordered by `created_at DESC`.
  - **Query parameters**:
    - **page** (integer, default `1`)
    - **pageSize** (integer, default `20`, max `100`)
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Summarize PRD",
      "summary": "Initial version",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

- **Get single version**
  - **Method**: GET
  - **URL**: `/api/prompts/{promptId}/versions/{versionId}`
  - **Description**: Fetch full content and metadata of a single version.
  - **Response 200**: Full version representation.

- **Create new version (manual save or from Improve)**
  - **Method**: POST
  - **URL**: `/api/prompts/{promptId}/versions`
  - **Description**: Create a new version of the prompt content and update `prompts.current_version_id`. Used for manual edits and when accepting an "Improve" suggestion.
  - **Request body**:

```json
{
  "title": "Updated title",
  "content": "New content...",
  "summary": "Tweaked tone and clarified instructions",
  "source": "manual", // "manual" | "improve"
  "baseVersionId": "uuid-or-null"
}
```

  - **Response 201**:

```json
{
  "version": {
    "id": "uuid-new-version",
    "promptId": "uuid",
    "title": "Updated title",
    "content": "New content...",
    "summary": "Tweaked tone and clarified instructions",
    "createdBy": "uuid",
    "createdAt": "2024-01-02T00:00:00.000Z"
  },
  "prompt": {
    "id": "uuid",
    "currentVersionId": "uuid-new-version",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

  - **Business logic**:
    - Validate `content` length `<= 100000`.
    - Validate `summary` length `<= 1000` when provided.
    - If `source = "improve"`, log `run_events` with `event_type = "improve_saved"`.

- **Restore version**
  - **Method**: POST
  - **URL**: `/api/prompts/{promptId}/versions/{versionId}/restore`
  - **Description**: Restore a previous version as current. Implementation creates a new version that copies the content from the selected version and sets it as current.
  - **Request body**:

```json
{
  "summary": "Restored version from 2024-01-01"
}
```

  - **Response 201**: Same shape as "Create new version".
  - **Business logic**:
    - Log `run_events` with `event_type = "restore"`.


#### 2.6 Runs (`runs`) and Execution

Runs track executions of prompts via OpenRouter and power both UX and quota enforcement.

**Run representation**

```json
{
  "id": "uuid",
  "promptId": "uuid",
  "userId": "uuid",
  "model": "openrouter/model",
  "status": "pending",
  "input": { "variables": { "name": "Alice" } },
  "output": { "text": "Hello Alice..." },
  "modelMetadata": { "provider": "openai" },
  "tokenUsage": { "inputTokens": 123, "outputTokens": 456 },
  "latencyMs": 1234,
  "errorMessage": null,
  "createdAt": "2024-01-02T12:34:00.000Z"
}
```

- **Run a prompt**
  - **Method**: POST
  - **URL**: `/api/prompts/{promptId}/runs`
  - **Description**: Execute the prompt against OpenRouter with given inputs, save the run record, and update `prompts.last_run_id`.
  - **Request body**:

```json
{
  "model": "openrouter/model-name",
  "input": {
    "variables": {
      "userName": "Alice"
    },
    "overridePrompt": null
  },
  "options": {
    "temperature": 0.7,
    "maxTokens": 1024
  }
}
```

  - **Response 201**:

```json
{
  "run": {
    "id": "uuid-run",
    "promptId": "uuid",
    "model": "openrouter/model-name",
    "status": "success",
    "input": {
      "variables": {
        "userName": "Alice"
      },
      "overridePrompt": null
    },
    "output": {
      "text": "Generated result..."
    },
    "modelMetadata": {
      "provider": "openai",
      "raw": {}
    },
    "tokenUsage": {
      "inputTokens": 123,
      "outputTokens": 456,
      "totalTokens": 579
    },
    "latencyMs": 1200,
    "errorMessage": null,
    "createdAt": "2024-01-02T12:34:00.000Z"
  }
}
```

  - **Business logic**:
    - Check **daily run quota** before calling OpenRouter; if exceeded, return **429 QUOTA_EXCEEDED**.
    - Enforce **rate limiting** per user/IP via Redis keys (e.g., N runs per minute).
    - Measure latency and store `latency_ms`.
    - Log `run_events` with `event_type = "run"`.

- **List runs for a prompt**
  - **Method**: GET
  - **URL**: `/api/prompts/{promptId}/runs`
  - **Description**: Paginated run list for a given prompt.
  - **Query parameters**:
    - **page** (integer, default `1`)
    - **pageSize** (integer, default `20`, max `100`)
    - **status** (string, optional; filter by run_status)
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid-run",
      "status": "success",
      "model": "openrouter/model-name",
      "latencyMs": 1200,
      "createdAt": "2024-01-02T12:34:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

- **Get run detail**
  - **Method**: GET
  - **URL**: `/api/runs/{runId}`
  - **Description**: Fetch a single run including full input and output payloads.
  - **Response 200**: Full run representation as above.


#### 2.7 Improve Workflow (AI Suggestions)

The "Improve" flow uses an execution-like endpoint but distinguishes analytics and quotas.

- **Get improvement suggestions for a prompt**
  - **Method**: POST
  - **URL**: `/api/prompts/{promptId}/improve`
  - **Description**: Call OpenRouter with a system prompt that requests improved variants of the current prompt. Returns one or more suggestions; does **not** persist them as versions until the user explicitly saves.
  - **Request body**:

```json
{
  "model": "openrouter/model-name",
  "input": {
    "currentPrompt": "Current prompt content...",
    "goals": "What the user is trying to achieve",
    "constraints": "Any constraints",
    "numSuggestions": 3
  },
  "options": {
    "temperature": 0.9
  }
}
```

  - **Response 200**:

```json
{
  "suggestions": [
    {
      "id": "temporary-id-1",
      "title": "Improved prompt v1",
      "content": "Improved prompt text...",
      "summary": "Clarified user role and output format",
      "model": "openrouter/model-name",
      "tokenUsage": {
        "inputTokens": 200,
        "outputTokens": 400
      }
    }
  ],
  "latencyMs": 1800
}
```

  - **Business logic**:
    - Check **daily improve quota**; enforce and emit **429 QUOTA_EXCEEDED** when exhausted.
    - Enforce rate limiting (shared with runs or separate bucket).
    - Log `run_events` with `event_type = "improve"`.
    - Saving an accepted suggestion is done via `POST /api/prompts/{promptId}/versions` with `source = "improve"`.


#### 2.8 Search

Although `GET /api/prompts` supports search, a dedicated endpoint can expose more advanced capabilities.

- **Search prompts**
  - **Method**: GET
  - **URL**: `/api/search/prompts`
  - **Description**: Full-text search across prompt title, content (latest version), and catalog names using `prompts.search_vector` and GIN index.
  - **Query parameters**:
    - **q** (string, required): Search query (keywords or phrase).
    - **tagIds** (comma-separated UUIDs, optional).
    - **catalogId** (UUID, optional).
    - **page** (integer, default `1`).
    - **pageSize** (integer, default `20`, max `50`).
    - **sort** (string, optional; `relevance` (default) or `updatedAtDesc`).
  - **Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Summarize PRD",
      "snippet": "You are a system for summarizing product requirements...",
      "score": 0.85,
      "catalog": {
        "id": "uuid",
        "name": "LLM Workflows"
      },
      "tags": [
        { "id": "uuid", "name": "summarization" }
      ],
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```


#### 2.9 Quotas and Usage

- **Get current usage and quotas**
  - **Method**: GET
  - **URL**: `/api/quota`
  - **Description**: Return remaining runs/improve quota for the current day and, optionally, high-level monthly cost cap status.
  - **Query parameters**: none
  - **Response 200**:

```json
{
  "date": "2024-01-02",
  "limits": {
    "runPerDay": 20,
    "improvePerDay": 20
  },
  "usage": {
    "runCount": 5,
    "improveCount": 2
  },
  "remaining": {
    "run": 15,
    "improve": 18
  },
  "costCap": {
    "daily": {
      "limitUsd": 5,
      "usedUsd": 1.2,
      "blocked": false
    },
    "monthly": {
      "limitUsd": 100,
      "usedUsd": 20,
      "blocked": false
    }
  }
}
```


#### 2.10 Analytics and Run Events (`run_events`) – Operator/Admin

These endpoints are intended for operators and may be protected behind an admin flag or separate environment; they can be omitted from the public UI.

- **List run events**
  - **Method**: GET
  - **URL**: `/api/admin/run-events`
  - **Description**: Paginated list of raw analytics events for KPI computation.
  - **Query parameters**:
    - **page** (integer, default `1`)
    - **pageSize** (integer, default `100`, max `500`)
    - **eventType** (string, optional; `run`, `improve`, `improve_saved`, `delete`, `restore`)
    - **from** (ISO timestamp, optional)
    - **to** (ISO timestamp, optional)
  - **Response 200**: List of events.

- **Aggregated metrics**
  - **Method**: GET
  - **URL**: `/api/admin/metrics`
  - **Description**: High-level aggregates (runs per day, improve_saved rate, error rates, latency stats).
  - **Query parameters**:
    - **from** (ISO timestamp, optional)
    - **to** (ISO timestamp, optional)
  - **Response 200**:

```json
{
  "runsPerDay": [
    { "date": "2024-01-01", "runs": 10, "improves": 3 }
  ],
  "improveSaveRate": 0.82,
  "averageLatencyMs": 1500,
  "errorRate": 0.03
}
```


### 3. Authentication and Authorization

- **Authentication mechanism**:
  - **Supabase Auth** manages Google OAuth and email-based sign-in.
  - The Next.js API routes validate the user by:
    - Reading the Supabase session from HTTP-only cookies (SSR/Edge) or bearer tokens.
    - Rejecting any request without a valid session with **401 UNAUTHORIZED**.

- **Authorization**:
  - DB-level:
    - Enable RLS on all user-owned tables (`prompts`, `prompt_versions`, `catalogs`, `tags`, `prompt_tags`, `runs`, `user_settings`, `run_events`).
    - Per-table policies restrict access to rows where `user_id = auth.uid()`.
  - API-level:
    - Endpoints never expose `user_id` in request bodies; they derive it from `auth.uid()`.
    - Even if a client attempts to inject a different `user_id`, the server ignores it and/or fails validation.

- **Admin/operator access**:
  - Admin endpoints (`/api/admin/*`) require an additional check:
    - Environment-based shared secret, or
    - Supabase custom claims/roles.
  - Admin actions may bypass RLS via Supabase service role keys, but only in controlled contexts.


### 4. Validation and Business Logic

#### 4.1 Validation Conditions by Resource

- **Prompts**
  - **Title**:
    - Required, non-empty.
    - Max length (e.g., 255 characters) enforced at API level.
  - **Catalog**:
    - If provided, must reference an existing `catalogs.id` for the same user.
  - **Tags**:
    - If provided, all `tagIds` must reference existing `tags.id` for the same user.
  - **Duplicate detection**:
    - On create, optionally run a similarity check on title/content; if high similarity found, include `duplicateWarning` but still allow creation unless user chooses to cancel.

- **Prompt versions**
  - **content**:
    - Required, non-empty.
    - Max length 100,000 characters (mirrors `CHECK (char_length(content) <= 100000)`).
  - **summary**:
    - Optional.
    - When provided, max length 1,000 characters (mirrors DB check).
  - **baseVersionId**:
    - When provided, must be a valid version of the same prompt and user.

- **Tags**
  - Name:
    - Required, non-empty, normalized (trimmed).
    - Unique per user when case-insensitive (enforced via `tags_user_name_idx` and API pre-check).

- **Catalogs**
  - Name:
    - Required, non-empty, trimmed.
    - Unique per user, case-insensitive (`UNIQUE (user_id, lower(name))`).

- **Runs**
  - **model**:
    - Required; must belong to an allowed list of OpenRouter models configured server-side.
  - **status**:
    - Must be one of `pending`, `success`, `error`, `timeout` (enum).
  - **latencyMs**:
    - Must be `>= 0` per DB check; computed server-side.
  - **tokenUsage**:
    - Must be either `null` or a JSON object; API normalizes this before insert.

- **Run events**
  - **eventType**:
    - Required; one of `run`, `improve`, `improve_saved`, `delete`, `restore`.
  - **payload**:
    - Optional JSON; structure is controlled by the server.

- **User settings**
  - **retentionPolicy**:
    - Must be one of `fourteen_days`, `thirty_days`, `always`.


#### 4.2 Business Logic Mapping

- **Versioning and retention**
  - Every meaningful change to prompt content creates a new version via `/api/prompts/{promptId}/versions`.
  - `prompts.current_version_id` always points to the latest version.
  - A scheduled job (Supabase edge function or `pg_cron`) enforces retention policies by deleting `prompt_versions` older than the chosen policy (`14` or `30` days) for each user, skipping `retentionPolicy = 'always'`.

- **Last run tracking**
  - `POST /api/prompts/{promptId}/runs`:
    - Insert new `runs` row.
    - Update `prompts.last_run_id` to point to this run.

- **Quotas and cost caps**
  - Quotas for runs and improve actions enforced in:
    - `POST /api/prompts/{promptId}/runs`
    - `POST /api/prompts/{promptId}/improve`
  - Implementation:
    - Redis counters keyed by `(userId, date, actionType)` track usage.
    - When usage reaches configured limit, endpoint returns **429** with code `QUOTA_EXCEEDED`.
  - Cost caps:
    - OpenRouter per-call estimated cost tracked via token usage in `runs` and/or `run_events`.
    - Daily/monthly aggregates guard further calls and respond with `QUOTA_EXCEEDED` once caps are reached.

- **Improve workflow**
  - `POST /api/prompts/{promptId}/improve`:
    - Logs `run_events` with `event_type = "improve"`.
    - Consumes from improve quota.
  - When a suggestion is saved via `POST /api/prompts/{promptId}/versions` with `source = "improve"`:
    - Logs `run_events` with `event_type = "improve_saved"`.
    - Contributes to KPI "improve_saved / total_improve_actions".

- **Prompt deletion**
  - `DELETE /api/prompts/{promptId}`:
    - Requires explicit confirmation on the client.
    - Deletes prompt and cascades to versions, runs, and tags linkage according to DB foreign keys.
    - Logs `run_events` with `event_type = "delete"`.

- **Search and indexing**
  - A DB trigger maintains `prompts.search_vector` based on:
    - `prompts.title`
    - Latest version content
    - Associated `catalog.name`
  - The GIN index on `search_vector` is used by:
    - `GET /api/prompts` with `search` param
    - `GET /api/search/prompts`

- **Error handling and UX**
  - OpenRouter errors:
    - API wraps gateway errors into JSON with code `OPENROUTER_ERROR` and message.
    - Logs an error run with `status = "error"` and `errorMessage` set.
  - Rate limiting:
    - Central middleware applies per-IP and per-user request rate limits using Redis; on breach returns **429 RATE_LIMITED** with retry hints.

- **Security**
  - All OpenRouter calls use a server-side key stored in environment variables; never exposed to the client.
  - API validates input lengths and character sets to prevent injection and abuse (e.g., extremely large JSON payloads).
  - All endpoints enforce HTTPS in production via deployment configuration.


#### 4.3 Pagination, Filtering, and Sorting

- **Pagination strategy**:
  - Default: 1-based `page` and `pageSize` parameters.
  - `pageSize` clamped to a reasonable upper bound (e.g., 100).
  - Responses include `page`, `pageSize`, and `total` for simple clients.
  - For very large datasets later, cursor-based pagination can be added (e.g., `cursor` query parameter).

- **Filtering**:
  - Prompts:
    - Filter by `tagIds`, `catalogId`, `search`, and `status` inferred from last run.
  - Runs:
    - Filter by `status`.
  - Tags and catalogs:
    - `search` query for partial name matches.

- **Sorting**:
  - Prompts:
    - Default sort by `updatedAt DESC` using `prompts_user_updated_idx`.
    - Optional sort by last run timestamp using `runs_prompt_created_idx`.
    - Relevance-based sort when using full-text search via `ts_rank_cd`.
  - Runs:
    - Default sort by `createdAt DESC` using `runs_prompt_created_idx` / `runs_user_created_idx`.


