# Product Requirements Document (PRD) - Promptana

## 1. Product Overview

Promptana is a web application for storing, structuring, executing, and improving AI prompts. Users can create prompts, organize them with tags and catalogs, search across prompts, run prompts through OpenRouter (server-side), review and store the last execution result, and generate AI-driven improvement suggestions. The MVP is single-user, server-driven for execution, and prioritizes a small budget and low operational complexity.

Key principles:

- Server-side OpenRouter integration (server-held key).
- Single-user MVP (no collaboration or public APIs).
- Emphasis on prompt discovery (tags, catalogs, full-text search), execution, versioning, and an "Improve" workflow.
- Quota constraints to control OpenRouter usage.

## 2. User Problem

Developers and prompt engineers need a reliable place to store, find, run, and iteratively improve prompts. Problems addressed:

- Fragmented prompt storage across local files and notes.
- Lack of structure (no tags/catalogs) makes discovery hard.
- No integrated, server-safe execution environment connected to an LLM gateway.
- Difficulty tracking prompt evolution; no version history or retention controls.
- No simple way to generate AI-assisted improvements and preserve them as versions.
- Need to control cost and usage of LLM calls in a small-budget environment.

Primary user goals:

- Quickly find relevant prompts.
- Run prompts safely and quickly without exposing keys.
- Iterate and save improvements with version history and retention policies.
- Keep costs predictable via quotas and limits.

## 3. Functional Requirements

FR-001 Authentication and Access

- Sign-in via Google OAuth and optional email-based sign-in (single-user account model).
- Session management and secure cookies over TLS.
- Server-side enforcement of authenticated access to UI and server endpoints.

FR-002 Prompt CRUD

- Create, read, update, delete prompts.
- Each prompt stores current content, metadata (title, description), tags, catalog membership, creation and modification timestamps, and last run result.

FR-003 Tagging and Catalogs

- Create, edit, delete tags and catalogs.
- Assign multiple tags and one catalog per prompt (catalog optional).
- Tag and catalog listing and filtering.

FR-004 Full-text Search

- Search across prompt content, title, tags, and catalog names.
- Support keyword search, phrase search, and tag filters.
- Return results ranked by relevance and last-updated.

FR-005 Execution (Playground)

- UI "Run" action that sends the prompt to the server.
- Server calls OpenRouter using a server-side key and returns response within the UI.
- Save the last run result and metadata (timestamp, latency, model, token usage if available).

FR-006 Improve Workflow

- "Improve" action: server uses OpenRouter to generate suggested improvements (one or multiple suggestions).
- UI lets the user accept, edit, and save an improved prompt as a new version.

FR-007 Versioning and Retention

- Save versions when prompts are modified or improved.
- Version metadata: author, timestamp, change summary, and diff from prior.
- User-configurable retention: 14 days, 30 days, or always.
- Automatic pruning of versions per retention policy.
- Ability to view version history and restore a past version to become current.

FR-008 Quotas and Limits

- Per-user daily limits for runs and "improve" operations (MVP default: 20 runs/day).
- Server-side enforcement and graceful UX when limits are reached.

FR-009 Export/Import

- Copy prompt content to clipboard for export.
- Simple import via UI paste into "New Prompt" only (no advanced import formats in MVP).

FR-010 Data Deletion/Privacy

- Deleting a prompt permanently removes it and related versions and run metadata from the server.
- Server must support full deletion and confirm irreversible removal.

FR-011 Observability and Timing

- Instrumentation to measure OpenRouter call timing for KPI tracking (time-to-first-result).
- Log OpenRouter errors and usage metrics for cost control.

FR-012 Security

- HTTPS/TLS for all client-server traffic.
- Do not store user OpenRouter keys; server stores only service key(s).
- Rate limiting and input validation on server endpoints.

FR-013 Error Handling and UX

- Clear UI for OpenRouter errors, retries, and partial failures.
- Informative messages for quota limits, network issues, and invalid inputs.

Data Model (minimal):

- Prompt: id, title, content, tags[], catalog_id, created_at, updated_at, current_version_id, last_run_id
- Version: id, prompt_id, content, created_at, author, summary
- Run/Execution: id, prompt_id, timestamp, model, latency_ms, input, output, status, token_usage
- Tag: id, name
- Catalog: id, name, description
- Settings: retention_policy, daily_run_quota, daily_improve_quota

Operational Constraints:

- OpenRouter calls must be server-side.
- Support for a few dozen concurrent users; budget target: $100/month.
- MVP single-user model; no team permissions.

## 4. Product Boundaries

In scope for MVP:

- Single-user account model (no collaboration or multi-user data separation).
- Google OAuth (primary) and email sign-in for access.
- Server-side OpenRouter integration with a single server key.
- Prompt CRUD, tags, catalogs, full-text search, run/playground, improve suggestions, versioning with retention, quotas, clipboard export.
- Instrumentation for KPI measurement (timing and counts).

Out of scope for MVP:

- Multi-user collaboration, sharing, or team permissions.
- User-provided LLM keys or client-side OpenRouter usage.
- Advanced import/export (no file-based export/import).
- Complex analytics dashboards beyond basic usage logs.
- Fine-grained ACLs and role-based access control.
- Marketplace, public prompt gallery, or API for external programmatic access.

Non-functional limits:

- Target average time-to-first-OpenRouter-result < 4s.
- Cost budget $100/month for OpenRouter + infra.
- Version retention policies limited to 14 days / 30 days / always.

## 5. User Stories

All user stories below include unique IDs and acceptance criteria. Each acceptance criterion is specific and testable.

US-002

- Title: Sign in with Email (optional)
- Description: As a user, I want an email-sign-in option so I can access the app without Google.
- Acceptance Criteria:
  - User can supply an email and receive a sign-in mechanism (magic link or password) per chosen implementation.
  - After completing the flow, user is authenticated and can access the app.
  - Test: Complete email sign-in and verify session and protected-endpoint access.

US-003

- Title: Create a New Prompt
- Description: As a user, I want to create and save a new prompt with metadata.
- Acceptance Criteria:
  - User can enter title, content, tags, and select a catalog.
  - Saved prompt appears in prompt list with correct metadata and timestamps.
  - Test: Create a prompt and confirm presence in list and API returns stored fields.

US-004

- Title: Edit an Existing Prompt
- Description: As a user, I want to edit prompt content and metadata.
- Acceptance Criteria:
  - Changes can be saved and create a new version.
  - Current prompt content updates immediately after save.
  - Test: Edit content, save, verify current content changed and a new version entry exists.

US-005

- Title: Delete a Prompt Permanently
- Description: As a user, I want to delete a prompt and its history permanently.
- Acceptance Criteria:
  - Deletion requires a confirmation action in the UI.
  - After deletion, prompt, its versions, and run metadata are no longer retrievable.
  - Test: Delete a prompt, then query API for prompt and versions -> 404 or empty.

US-006

- Title: Create/Edit/Delete Tags
- Description: As a user, I want to manage tags for organization.
- Acceptance Criteria:
  - User can create a tag and see it in tag list.
  - Tags can be edited or deleted; removing a tag disassociates it from prompts.
  - Test: Create tag, assign to prompt, delete tag, verify prompt no longer lists the tag.

US-007

- Title: Create/Edit/Delete Catalogs
- Description: As a user, I want catalogs for grouping prompts.
- Acceptance Criteria:
  - User can create a catalog, assign prompts, edit or delete a catalog.
  - Deleting a catalog must either unassign prompts or require reassignment per UI flow; changes persist.
  - Test: Create catalog, assign prompt, delete catalog, verify prompt catalog_id cleared.

US-008

- Title: Full-text Search
- Description: As a user, I want to find prompts by keywords, tags, and catalog.
- Acceptance Criteria:
  - Search returns matching prompts by content, title, tag, and catalog name.
  - Filters for tag(s) and catalog may be applied.
  - Results are sorted by relevance and/or last-updated.
  - Test: Create prompts with distinctive terms and verify search finds expected items.

US-009

- Title: Run Prompt via Playground
- Description: As a user, I want to run a prompt and receive the OpenRouter response.
- Acceptance Criteria:
  - Clicking Run triggers server call to OpenRouter and returns a response within the UI.
  - Last run result is saved with timestamp and visible on prompt detail.
  - Test: Run a prompt, verify output shown and run record persisted with latency.

US-010

- Title: Handle OpenRouter Errors
- Description: As a user, I want meaningful error messages if execution fails.
- Acceptance Criteria:
  - UI displays a clear error and an option to retry.
  - Server logs the error for analysis.
  - Test: Simulate OpenRouter failure and verify UI message and server error log entry.

US-011

- Title: Improve Prompt with AI Suggestions
- Description: As a user, I want AI-generated improvement suggestions and to save an improved version.
- Acceptance Criteria:
  - Clicking Improve returns one or more suggested prompt variants from OpenRouter.
  - User can edit a suggestion and save it as a new version.
  - Saving creates a new version entry and updates current prompt.
  - Test: Click Improve, accept suggestion, save, verify new version exists and current content matches saved suggestion.

US-012

- Title: Version History and Restore
- Description: As a user, I want to view and restore previous prompt versions.
- Acceptance Criteria:
  - UI shows a list of versions with timestamps and summaries.
  - Restoring a version sets it as the current content and creates a new version entry for the restoration action.
  - Test: Restore an older version and verify current content changes and new version recorded.

US-013

- Title: Version Retention Settings
- Description: As a user, I want to configure how long past versions are kept.
- Acceptance Criteria:
  - User can select 14 days, 30 days, or always in settings.
  - System automatically prunes versions older than configured retention (for 14/30).
  - Test: Set retention to 14 days, simulate versions older than 14 days, verify they are pruned.

US-014

- Title: Quota Enforcement
- Description: As a user, I need daily limits to be enforced for runs and improvements.
- Acceptance Criteria:
  - Server tracks usage and prevents further runs or improvements after quota is reached for the day.
  - UI shows remaining quota and a clear message when quota is exhausted.
  - Test: Consume daily quota and verify run and improve actions are blocked and return appropriate UI message.

US-015

- Title: Clipboard Export
- Description: As a user, I want to copy prompt content to clipboard easily.
- Acceptance Criteria:
  - A "Copy" control copies prompt content to clipboard and shows confirmation.
  - Test: Click copy and verify clipboard contains exact prompt text.

US-016

- Title: Permanent Deletion Confirmation and Safety
- Description: As a user, I want to be warned before permanent deletion.
- Acceptance Criteria:
  - Deletion requires explicit confirmation (e.g., typing the prompt name or clicking a confirm button).
  - After deletion, there is no UI option to recover; API returns no data.
  - Test: Attempt deletion and verify confirmation flow and irreversibility.

US-017

- Title: Handling Large Prompts
- Description: As a user, I may have very long prompt text that must be handled correctly.
- Acceptance Criteria:
  - System accepts prompt content up to defined size limit (document explicit limit).
  - UI warns user if content exceeds safe execution size; prevents Run if unsupported by OpenRouter quota/model limits.
  - Test: Submit a prompt at size limit and confirm persistence; try to exceed limit and verify rejection.

US-018

- Title: Duplicate Prompt Detection (UX)
- Description: As a user, the app should help avoid accidental duplicate prompts.
- Acceptance Criteria:
  - On create, if a similar prompt exists (title/content similarity threshold), UI shows possible duplicates and asks for confirmation.
  - Test: Create a duplicate-like prompt and verify duplicate suggestion shown.

US-019

- Title: Network and Offline Behavior
- Description: As a user, I need clear behavior when network is unavailable.
- Acceptance Criteria:
  - UI shows offline state and prevents actions requiring server (Run, Improve, Save).
  - Local edits may be allowed UX-wise but must not be lost; on reconnect, user can retry actions.
  - Test: Simulate offline and verify blocked actions and messages.

US-020

- Title: Logging for KPI Measurement
- Description: As a product owner, I want to measure runs, improvements, and OpenRouter latency.
- Acceptance Criteria:
  - Server logs each run/improve with timestamp, duration, status.
  - Basic dashboard or logs accessible to operators to confirm metrics exist.
  - Test: Run prompts and verify entries in instrumentation with latency values.

US-021

- Title: Account Sign-out
- Description: As a user, I need to sign out securely.
- Acceptance Criteria:
  - User can sign out and session invalidated server-side.
  - Test: Sign out and verify protected endpoints require re-authentication.

US-022

- Title: Unauthorized Access Prevention
- Description: As an operator, I need to ensure unauthenticated or invalid requests are rejected.
- Acceptance Criteria:
  - All prompt-related endpoints return 401/403 for unauthenticated requests.
  - Test: Call API without auth token and verify 401/403 responses.

US-023

- Title: Graceful OpenRouter Cost Limits
- Description: As an operator, I want the app to limit OpenRouter usage to stay within budget.
- Acceptance Criteria:
  - Admin-level configuration for daily/monthly caps is available.
  - When cap reached, new runs/improvements are blocked and users get explanatory message.
  - Test: Simulate cap reached and verify blocked behavior and message.

US-024

- Title: Input Validation and Sanitization
- Description: As a system, we must validate user inputs to prevent injection or malformed data.
- Acceptance Criteria:
  - Prompt content, titles, tags, and catalogs are validated for length and allowed characters.
  - Backend rejects malformed inputs with clear validation errors.
  - Test: Send invalid payloads and verify validation error responses and no persistence.

US-025

- Title: Analytics Events for User Flows
- Description: As a product manager, I want events for key actions (create, run, improve, save-improved) for KPI tracking.
- Acceptance Criteria:
  - Events are emitted for create/run/improve/save/restore/delete with timestamps and user context.
  - Events can be used to compute KPIs: improve->save rate, tried prompts ratio.
  - Test: Perform actions and verify events logged and contain required fields.

US-026

- Title: Accessibility and Usability Basic Compliance
- Description: As a user, the app should be navigable and usable with keyboard and screen readers.
- Acceptance Criteria:
  - Major controls (Run, Improve, Save, Delete) are keyboard-accessible with ARIA labels.
  - Basic WCAG checks pass for required pages.
  - Test: Navigate UI with keyboard and validate ARIA attributes for major controls.

US-027

- Title: Rate Limit Handling
- Description: As a user, I need to be informed when the server is rate-limited.
- Acceptance Criteria:
  - If server rate limits requests, UI shows a clear transient message and retry suggestions.
  - Test: Induce rate limit and verify UI message and server returns appropriate 429.

US-028

- Title: Prompt Listing and Pagination
- Description: As a user, I want to browse my prompt list with pagination or infinite scroll.
- Acceptance Criteria:
  - Prompt list supports pagination or infinite scroll and sorts by default (e.g., last-updated).
  - Test: Create > page-size prompts and verify navigation through pages or load more.

US-029

- Title: Prompt Preview and Details
- Description: As a user, I want to preview prompt content and last run result from the list.
- Acceptance Criteria:
  - List displays title, snippet of content, tags, and last run timestamp/result summary.
  - Clicking opens full detail view with run history and version history.
  - Test: From list, open prompt and verify detail contents and last run displayed.

US-030

- Title: Confirmation of Improved Version Save Rate Tracking
- Description: As product owner, we must track whether "Improve" suggestions are saved as versions.
- Acceptance Criteria:
  - When a user uses Improve and saves a suggestion, the event is logged as "improve_saved".
  - System computes metric (improve_saved / total_improve_actions).
  - Test: Perform improve flows and verify events and derived metric.

(End of user stories list for MVP; each is testable via UI and API verification steps above.)

Checklist review:

- Each user story is written with testable acceptance criteria.
- Authentication and authorization covered (US-001, US-021, US-022).
- Stories include basic, alternative, and edge cases (quota, OpenRouter errors, duplicates, large inputs, offline, rate limits).
- The set is sufficient to implement core MVP features: storage, search, run, improve, versioning, retention, quotas, and security.

## 6. Success Metrics

Primary product KPIs (MVP targets)

- Improve-to-save rate: 80% of "improve" actions result in saving an improved version (target: >= 80%).
- Prompt trial rate: 70% of created prompts are run at least once via the UI (target: >= 70%).
- Time to first OpenRouter result: average < 4 seconds.
- Daily active users (DAU) and retention: track 7d/30d retention for usage signals.
- OpenRouter error rate: keep below an operational threshold (e.g., < 5% of calls).
- Cost per active user: keep average infra + OpenRouter cost <= budget targets; initial target $100/month.

Operational metrics to collect

- Runs per user per day and improvements per user per day.
- Per-request OpenRouter latency, success/failure codes, token usage/cost per call.
- Version retention counts and rate of automatic pruning actions.
- Quota breach events and frequency.

Measurement plan

- Instrument server to emit events for create/run/improve/save/delete/restore with timestamps, durations, status codes, and minimal context (prompt_id).
- Use simple daily aggregation to compute the KPIs.
- Track cost and volume of OpenRouter calls to enforce caps and adjust quotas.

Final notes

- Prioritize implementing secure server-side OpenRouter integration, auth, prompt CRUD, run/improve flows, and versioning with retention for the first release.
- Keep UX simple and explicit about quotas and permanent deletions.
- Maintain the single-user constraint for MVP to reduce scope and simplify data model and security.
