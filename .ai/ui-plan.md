## UI Architecture for Promptana

## 1. UI Structure Overview

Promptana is a single-user, workspace-style web application focused on creating, organizing, running, and improving AI prompts. The UI is organized around a persistent application shell with:

- **Desktop layout**: Left sidebar for global sections (Prompts, Catalogs, Tags, Search, Settings), a top app bar with global search and user menu, and a main content area that hosts list/detail views.
- **Mobile layout**: Top app bar with hamburger menu (drawer for the same global sections) and an optional bottom tab bar (Prompts, Search, Settings); list and detail views are stacked full-screen.
- **App shell & auth gating**: All authenticated views are rendered inside a shared app shell. On initial load and route transitions, the shell calls `/api/me` to determine auth state and either renders the workspace or a “Sign in required” experience.
- **Primary resource-driven views**: Prompts, Catalogs, Tags, Search, Runs (embedded), Versions (embedded), and Settings each map to REST endpoints from the API plan.
- **Data layer**: React Query (or equivalent) is used for data fetching, caching, mutations, and error handling for all REST endpoints, with short stale times for lists and more dynamic handling for search results.
- **Key UX principles**: Fast access to prompts (home = Prompt List), clear Run/Improve workflows, visible quotas, safe destructive actions, and basic but intentional accessibility (keyboard navigation, ARIA for key controls, semantic landmarks).

This structure ensures compatibility with the API plan (resource-aligned views) and supports all PRD user stories (auth, CRUD, search, run, improve, versioning, quotas, and basic analytics observability via run/improve UI actions).

## 2. View List

### 2.1 Auth Gate & Sign-in Required

- **View name**: Auth Gate / Sign-in Required
- **View path**: Conceptual path `/` (unauthenticated), used as a wrapper around all app routes; shows sign-in-required state when `/api/me` returns 401.
- **Main purpose**: Guard all application routes behind Supabase authentication and offer clear entry points into sign-in flows.
- **Key information to display**:
  - App name and short description (“Store, run, and improve your prompts safely.”).
  - Explanation that sign-in is required to access prompts and runs.
  - Actions to “Sign in with Google” and “Sign in with Email” (linking into Supabase’s auth flows).
- **Key view components**:
  - **Auth status gate**: Wrapper that calls `/api/me`, branches into workspace shell vs sign-in-required view.
  - **Sign-in required panel**: Centered card with headline, description, and sign-in buttons.
  - **Error message area**: For unexpected errors during `/api/me` calls.
- **UX considerations**:
  - Simple, focused layout; clear primary action.
  - Loading state while `/api/me` is pending; smooth transitions when auth completes.
  - Clear messaging on expired sessions and a one-click path back to sign-in.
- **Accessibility considerations**:
  - Main landmark with descriptive heading.
  - Buttons reachable and operable via keyboard; ARIA labels for sign-in methods.
  - Error states announced via live region.
- **Security considerations**:
  - No app data or navigation shown until `/api/me` confirms a valid session.
  - Any 401 from workspace views triggers this gate again and clears stale state.
- **Mapped PRD items**:
  - **US-001, US-002, US-021, US-022**; **FR-001, FR-012**.

### 2.2 Workspace Shell & Navigation Layout

- **View name**: Workspace Shell
- **View path**: Layout wrapper for all authenticated routes (e.g., `/prompts`, `/prompts/:id`, `/catalogs`, `/tags`, `/search`, `/settings`).
- **Main purpose**: Provide consistent navigation, global context (quota, search, user menu), and responsive layout across all authenticated views.
- **Key information to display**:
  - App logo/name.
  - Global navigation sections: Prompts, Catalogs, Tags, Search, Settings.
  - User identity (email/avatar) and Sign out.
  - Optional high-level quota summary (e.g., remaining runs/improve today).
- **Key view components**:
  - **Left sidebar (desktop)**:
    - Sections: Prompts, Catalogs (expandable list), Tags, Search, Settings.
    - Catalog subtree with selectable catalogs that scope the Prompt List.
  - **Top app bar**:
    - Global search field that navigates to Search Results on submit.
    - User menu with email, “Sign out” (calls `/api/auth/signout`), and possibly simple “Help/About”.
  - **Main content area**:
    - Hosts the active view (Prompt List, Prompt Detail, etc.).
  - **Mobile navigation**:
    - Hamburger menu that opens a navigation drawer with the same sections.
    - Optional bottom tab bar exposing Prompts, Search, Settings.
- **UX considerations**:
  - Clear selection state for current section and catalog.
  - Simple, predictable navigation hierarchy with resource-focused routes.
  - Catalog expansion filters the Prompt List without confusing the global nav state.
- **Accessibility considerations**:
  - Sidebar and top bar use landmark roles (`navigation`, `banner`) and descriptive labels.
  - Keyboard-focusable nav items, with visible focus states.
  - Drawer and menus trap focus appropriately and are dismissible via Esc.
- **Security considerations**:
  - Shell only renders when auth is verified.
  - Sign out always revokes session and returns to Auth Gate.
- **Mapped PRD items**:
  - **US-001, US-021, US-022, US-026**; supports all prompt/catalog/tag/search/settings user stories structurally.

### 2.3 Prompt List (Home)

- **View name**: Prompt List (Home)
- **View path**: `/prompts` (also default for `/` after auth).
- **Main purpose**: Primary hub for discovering, browsing, and quickly acting on prompts.
- **Key information to display**:
  - Paginated list of prompts (from `GET /api/prompts`), including:
    - Title.
    - Catalog (name or “Unassigned”).
    - Tags (small chip list).
    - Last run status and timestamp (when available).
    - Last updated timestamp.
  - Active filters: search query, selected tags, selected catalog, sort order.
  - Optional density toggle (comfortable vs compact).
- **Key view components**:
  - **Prompt table/list**:
    - Sortable columns for title, catalog, last run, updated at (mapping to `sort` query param where applicable).
    - Responsive layout: table on desktop, card/list layout on small screens.
  - **Filters bar**:
    - Local search input (mapped to `search` query param on `/api/prompts`).
    - Tag multi-select (mapped to `tagIds` query param).
    - Catalog selector (or integrated with sidebar selection).
    - Sort selector.
  - **Row-level quick actions**:
    - Run (invokes `POST /api/prompts/{id}/runs`).
    - Open (navigates to Prompt Detail).
    - More menu (Copy title/content, Delete, etc., where appropriate).
  - **Pagination controls**:
    - Page and page size controls aligned with API pagination.
- **UX considerations**:
  - Quick read of each prompt’s purpose via title and content snippet (optional).
  - Efficient scanning using compact density, especially for power users.
  - Clear indication when filters are active; easy reset to “All prompts”.
- **Accessibility considerations**:
  - Table headers labeled; appropriate semantics for lists on mobile.
  - Quick actions accessible via keyboard and screen reader (e.g., “Run prompt”, “Open prompt details”).
  - ARIA sort indicators on sortable columns.
- **Security considerations**:
  - No destructive action (Delete) without confirmation dialog.
  - All requests respect auth; any 401/403 triggers graceful message and potential re-auth.
- **Mapped PRD items**:
  - **US-003, US-004, US-005, US-008, US-009, US-018, US-019, US-028, US-029**; **FR-002, FR-004, FR-005, FR-013**.

### 2.4 Prompt Detail – Overview Tab

- **View name**: Prompt Detail – Overview
- **View path**: `/prompts/:promptId?tab=overview` (default tab).
- **Main purpose**: View and edit prompt content and metadata, run or improve the prompt, and see the most recent result.
- **Key information to display**:
  - Editable title.
  - Main prompt content editor (large text area or code-like editor).
  - Catalog selector (single).
  - Tags selector (multi).
  - Last run summary (status, timestamp, model, latency, brief result snippet).
  - Quota information near Run/Improve buttons (e.g., “Runs: 5/20 today”).
- **Key view components**:
  - **Top bar within detail**:
    - Editable title with inline validation.
    - Catalog dropdown and tag multi-select.
    - Primary actions: Run, Improve, Copy, Delete.
  - **Prompt editor**:
    - Text area/editor with dirty-state tracking and character count (enforces max content length from validation rules).
  - **Result panel**:
    - Toggleable panel that can show:
      - Last Run output.
      - Basic run metadata (model, latency, token usage if available).
    - Optionally collapsed/expanded for focus.
  - **Unsaved changes dialog**:
    - Triggered when navigating away or invoking Run/Improve with unsaved edits.
    - Options: save as new version, continue without saving, cancel.
- **UX considerations**:
  - Clear differentiation between Run and Improve (labels, icons, descriptions, tooltips).
  - Smooth feedback when actions complete; automatic updating of last run summary.
  - Non-blocking result panel so the user can iterate on the prompt while seeing the last output.
- **Accessibility considerations**:
  - Tabs keyboard-accessible with visible focus.
  - Clear labels for Run and Improve, with ARIA descriptions for their behaviors.
  - Dialogs are focus-trapped and announce purpose and options.
- **Security considerations**:
  - Delete requires explicit confirmation matching permanent deletion semantics.
  - No exposure of raw OpenRouter keys; only server-driven run/improve actions via endpoints.
- **Mapped PRD items**:
  - **US-003, US-004, US-005, US-009, US-010, US-011, US-014, US-015, US-016, US-017, US-018, US-019, US-020, US-024, US-025, US-027, US-030**; **FR-002, FR-005, FR-006, FR-007, FR-008, FR-011, FR-012, FR-013**.

### 2.5 Prompt Detail – Runs Tab and Run Inspection

- **View name**: Prompt Detail – Runs
- **View path**: `/prompts/:promptId?tab=runs`; optional deep-link `/prompts/:promptId/runs/:runId` for focused run inspection.
- **Main purpose**: View recent runs for a prompt, inspect full input/output, and understand performance and errors.
- **Key information to display**:
  - List of runs (status, model, latency, created at).
  - For selected run: full input variables, override prompt (if any), full output text, error details when applicable, token usage.
- **Key view components**:
  - **Runs list**:
    - Paginated list backed by `GET /api/prompts/{promptId}/runs`.
    - Filters by status (e.g., success/error).
  - **Run detail panel**:
    - Inline panel or slide-over showing details from `GET /api/runs/{runId}` (or enriched list data).
    - Copy actions for result text.
  - **Error display**:
    - Clear messaging when runs failed due to OpenRouter errors, quota, or rate limits.
- **UX considerations**:
  - Easy to scan run history and see patterns (e.g., which models are used, latency).
  - Clicking a run does not navigate away entirely; uses panel or in-tab detail to keep context.
- **Accessibility considerations**:
  - List semantics for runs; each item labelled with status and timestamp.
  - Run detail panel with headings and clear structure.
- **Security considerations**:
  - No sensitive internal error details beyond what’s safe to show; detailed logs remain server-side.
- **Mapped PRD items**:
  - **US-009, US-010, US-017, US-020, US-027, US-029**; **FR-005, FR-011, FR-013**.

### 2.6 Prompt Detail – Versions Tab

- **View name**: Prompt Detail – Versions
- **View path**: `/prompts/:promptId?tab=versions`.
- **Main purpose**: Show version history, support inspection of earlier versions, and allow restoring previous versions safely.
- **Key information to display**:
  - List of versions (summary, created at, author when applicable).
  - For selected version: full content, title, summary.
  - Retention-related hints (e.g., versions older than policy may be pruned automatically).
- **Key view components**:
  - **Versions list**:
    - Paginated list backed by `GET /api/prompts/{promptId}/versions`.
  - **Version detail panel**:
    - Shows full version content; side-by-side or overlay compare to current version is optional (not required for MVP).
  - **Restore action**:
    - Button in each version row or detail that calls `POST /api/prompts/{promptId}/versions/{versionId}/restore`.
    - Optional confirmation dialog summarizing what will happen.
- **UX considerations**:
  - Clear indication of which version is current.
  - Concise summaries help scanning (“Tweaked tone”, “Added system message”, etc.).
  - Restoring creates a new version rather than mutating history; UI messaging should reflect this.
- **Accessibility considerations**:
  - Version list with clearly labelled items; restore controls keyboard accessible.
  - Restore confirmation with clear text and focus management.
- **Security considerations**:
  - Restore is reversible only by making another restore; UI should reinforce irreversibility of individual deletions when applicable.
- **Mapped PRD items**:
  - **US-004, US-007 (retention side-effects), US-012, US-013, US-014, US-020, US-025, US-030**; **FR-006, FR-007, FR-008, FR-010**.

### 2.7 New Prompt

- **View name**: New Prompt
- **View path**: `/prompts/new`.
- **Main purpose**: Create a new prompt (metadata + content) and its initial version.
- **Key information to display**:
  - Empty (or template) fields for title, content, catalog, tags, initial version summary.
  - Duplicate warning if potential duplicates exist.
- **Key view components**:
  - **Create form**:
    - Title input with live validation.
    - Content editor with character count and safe-limit indicator.
    - Catalog dropdown and tag multi-select.
    - Optional “summary” for the initial version.
  - **Duplicate detection warning**:
    - Inline or modal message if API returns a `duplicateWarning` (list of similar prompts).
    - Actions: proceed anyway, cancel, or open similar prompt in a new tab.
- **UX considerations**:
  - Guidance text (e.g., “Describe the purpose and context for your prompt”).
  - Clear primary action “Create prompt”.
  - Smooth transition to Prompt Detail after successful creation.
- **Accessibility considerations**:
  - Form fields labelled with error messages linked to inputs.
  - Duplicate warning communicated via accessible dialog or inline alert.
- **Security considerations**:
  - Validation errors surfaced clearly; malformed inputs never silently accepted.
- **Mapped PRD items**:
  - **US-003, US-004, US-018**; **FR-002, FR-004, FR-010, FR-024**.

### 2.8 Catalogs Management

- **View name**: Catalogs Management
- **View path**: `/catalogs`.
- **Main purpose**: Create, edit, and delete catalogs used to organize prompts.
- **Key information to display**:
  - Catalog list with name, description, created/updated timestamps, and optionally number of prompts in each.
- **Key view components**:
  - **Catalogs table/list**:
    - Backed by `GET /api/catalogs` with pagination and search.
  - **Create/Edit catalog dialog**:
    - Name and description fields, with validation and uniqueness error handling.
  - **Delete confirmation**:
    - Clearly explains that deletion unassigns catalog from prompts rather than deleting prompts.
- **UX considerations**:
  - Simple CRUD workflow with minimal friction.
  - Entries in this view reflect in prompt filters and sidebar catalog list.
- **Accessibility considerations**:
  - Forms and dialogs with proper labels and focus management.
  - Delete confirmation clearly announced.
- **Security considerations**:
  - All actions scoped to the current user; 404/403 handled gracefully.
- **Mapped PRD items**:
  - **US-007, US-008, US-028**; **FR-003, FR-004, FR-024**.

### 2.9 Tags Management

- **View name**: Tags Management
- **View path**: `/tags`.
- **Main purpose**: Create, rename, and delete tags and understand where they are used.
- **Key information to display**:
  - Tag list with name, created timestamp, and optionally count of prompts using each tag.
- **Key view components**:
  - **Tags table/list**:
    - Backed by `GET /api/tags` with pagination and search.
  - **Create/Edit tag dialog**:
    - Name field with validation and uniqueness error messages.
  - **Delete confirmation**:
    - Text clarifying that deleting a tag disassociates it from prompts.
- **UX considerations**:
  - Lightweight management experience; quick to add and rename tags during normal use.
  - Integration with Prompt Detail tag selector (in-place “Create new tag”).
- **Accessibility considerations**:
  - Form semantics and keyboard access for all actions.
- **Security considerations**:
  - Prevents tag name collisions via clear 409 error handling.
- **Mapped PRD items**:
  - **US-006, US-008, US-028**; **FR-003, FR-024**.

### 2.10 Global Search Results

- **View name**: Global Search Results
- **View path**: `/search?q=...&tagIds=...&catalogId=...`.
- **Main purpose**: Provide powerful full-text search across prompts, tags, and catalogs beyond the simpler Prompt List search.
- **Key information to display**:
  - Search query and applied filters.
  - List of matching prompts showing:
    - Title.
    - Content snippet with highlighted matches.
    - Catalog and tags.
    - Relevance score (optional).
    - Updated at.
- **Key view components**:
  - **Search input and filters**:
    - Mirrors global search field, allowing refinement within the view.
    - Tag and catalog filters mapped to search endpoint query.
  - **Results list**:
    - Backed by `GET /api/search/prompts`.
    - Card or list layout with emphasis on matched text.
  - **Empty and error states**:
    - “No results” messaging with suggestions.
- **UX considerations**:
  - Obvious distinction between local Prompt List filtering and global search.
  - Easy navigation from results to Prompt Detail.
- **Accessibility considerations**:
  - Results list semantics; highlight markup readable by screen readers.
- **Security considerations**:
  - Only authenticated user’s data is searchable; consistent with RLS and auth.
- **Mapped PRD items**:
  - **US-008, US-018, US-028, US-029**; **FR-004, FR-009, FR-011**.

### 2.11 Settings (Retention & Quota Info)

- **View name**: User Settings
- **View path**: `/settings`.
- **Main purpose**: Allow the user to configure version retention policy and view quota-related information.
- **Key information to display**:
  - Current retention policy (14 days, 30 days, always).
  - Explanation of what each option means (e.g., automatic pruning behavior).
  - Read-only view of daily run/improve quota (from `/api/quota`) and, optionally, cost cap summary.
- **Key view components**:
  - **Retention policy selector**:
    - Radio buttons or segmented control for the three allowed values.
    - Backed by `GET/PUT /api/settings`.
  - **Quota and cost panel**:
    - Uses `GET /api/quota` to show current usage and limits.
  - **Save/feedback area**:
    - Shows success or validation error messages.
- **UX considerations**:
  - Clear explanation of trade-offs between retention options.
  - Non-technical language for quotas and cost caps where possible.
- **Accessibility considerations**:
  - Form labels and descriptions, with error feedback tied to controls.
- **Security considerations**:
  - Settings scoped to current user only; admin-like knobs withheld.
- **Mapped PRD items**:
  - **US-013, US-014, US-020, US-023, US-025**; **FR-007, FR-008, FR-011**.

### 2.12 Mobile Navigation Variants

- **View name**: Mobile Navigation Views (patterns across routes)
- **View path**: Same as desktop, with responsive layout behavior.
- **Main purpose**: Ensure all primary workflows (browse, create, run, improve, manage tags/catalogs, search, settings) are usable on smaller screens.
- **Key information to display**:
  - For each main route, a single-column layout stacking key content (lists before actions, or vice versa depending on flow).
- **Key view components**:
  - **Top app bar**:
    - Hamburger icon, page title, and optional Run/Improve actions when in Prompt Detail.
  - **Bottom tab bar**:
    - Shortcuts to Prompts, Search, and Settings.
  - **Drawers and full-screen dialogs**:
    - Used for filters, Improve suggestions, run details, and forms to preserve context.
- **UX considerations**:
  - Back navigation gestures and buttons always available.
  - Run and Improve available without excessive scrolling.
- **Accessibility considerations**:
  - Hit targets sized appropriately; focus order respects visual order.
- **Security considerations**:
  - Same auth gating and error handling as desktop; no extra sensitive data exposed.
- **Mapped PRD items**:
  - Supports all user stories with emphasis on **US-019, US-026** (usability and accessibility).

## 3. User Journey Map

### 3.1 Primary Journey: Create, Run, Improve, and Version a Prompt

1. **Sign in**:
   - User lands on Auth Gate; chooses Google or Email sign-in.
   - After successful Supabase auth, `/api/me` returns 200 and the user is routed into the **Prompt List (Home)**.
2. **Discover prompts**:
   - In Prompt List, user browses existing prompts in the table, optionally filtering by catalog/tags or searching.
   - They can quickly run an existing prompt via the Run quick action, or click the row/title to open **Prompt Detail – Overview**.
3. **Create a new prompt**:
   - From Prompt List, user clicks “New Prompt” (button in list header).
   - In **New Prompt** view, they enter title, content, assign tags and a catalog, and optionally a summary.
   - On submit, the app calls `POST /api/prompts`; on success, navigates directly to **Prompt Detail – Overview** for the new prompt.
4. **Run the prompt**:
   - In **Prompt Detail – Overview**, user ensures content and metadata are correct.
   - They click **Run**; if there are unsaved edits, a dialog prompts to save as a new version first or continue without saving.
   - The app calls `POST /api/prompts/{id}/runs`; on success, last run summary and result panel update; quota counters and banners are refreshed.
5. **Improve the prompt**:
   - User clicks **Improve**; again, unsaved changes may trigger the save/continue/cancel dialog.
   - The app calls `POST /api/prompts/{id}/improve`; suggestions appear in an Improve panel/drawer.
   - User reviews one or more variants, optionally edits a chosen suggestion inline.
6. **Save an improved version**:
   - From the Improve panel, user chooses “Save as new version”.
   - The app calls `POST /api/prompts/{id}/versions` with `source = "improve"`.
   - On success, the editor updates to the improved content, and the new version appears in the **Versions** tab; analytics event coverage is implicitly supported.
7. **Review runs and versions**:
   - User navigates to **Runs** tab to inspect run history and outcomes.
   - User navigates to **Versions** tab to see version history and, if necessary, uses Restore to revert to an earlier version.

### 3.2 Supporting Journeys

- **Organize prompts with catalogs and tags**:
  - User opens **Catalogs Management** to create a catalog and **Tags Management** to define tags.
  - In **Prompt Detail – Overview** or **New Prompt**, they assign catalog and tags via selectors.
  - Back in **Prompt List**, they filter by catalog or tags to quickly find relevant prompts.

- **Search and discovery**:
  - User types into the global search field in the top bar; pressing Enter navigates to **Global Search Results**.
  - From Search Results, user opens prompt details or uses filters to refine results.

- **Quota and retention management**:
  - User visits **Settings** to adjust retention policy and understand pruning behavior.
  - Quota usage is visible near Run/Improve and in Settings, allowing the user to plan usage.

- **Error and offline handling**:
  - If run/improve calls fail due to OpenRouter errors or rate limits, inline messages in Prompt Detail plus global toasts explain the issue and suggest retry.
  - If the network is unavailable, relevant actions are disabled and an offline banner is shown; user can continue local edits until connectivity is restored.

## 4. Layout and Navigation Structure

### 4.1 Top-Level Navigation

- **Primary sections**:
  - **Prompts**: `/prompts` (home), `/prompts/new`, `/prompts/:id`.
  - **Catalogs**: `/catalogs`.
  - **Tags**: `/tags`.
  - **Search**: `/search`.
  - **Settings**: `/settings`.
- **Sidebar behavior (desktop)**:
  - Prompts, Catalogs, Tags, Search, Settings appear as main items.
  - Catalogs section can expand to list individual catalogs; selecting a catalog navigates to `/prompts` with a `catalogId` filter and highlights the catalog.
- **Top bar navigation**:
  - Global search input; on submit, navigates to `/search` with query parameters.
  - User menu with Sign out; triggers `/api/auth/signout` then returns to Auth Gate.

### 4.2 Intra-View Navigation

- **Prompt Detail tabs**:
  - Implemented as tabs or URL state (`tab=overview|runs|versions`) to allow deep-linking.
  - Tab switches do not cause full-page refetch; shared prompt data is reused while tab-specific lists (runs, versions) are fetched as needed.
- **Drill-down patterns**:
  - Run inspection uses an inline panel within the Runs tab; optionally deep-linkable.
  - Improve suggestions appear in a panel or drawer attached to the Overview tab, preserving editor context.

### 4.3 Responsive Layout Behavior

- **Desktop**:
  - Sidebar always visible; main content may use split panes (e.g., editor + results panel).
  - Prompt List may optionally coexist with Prompt Detail in a master–detail layout for wide screens in a later iteration (not required for MVP).
- **Mobile and tablet**:
  - Sidebar collapses into a hamburger-driven drawer.
  - Content is single-column; Prompt Detail stacks title/actions, editor, and panels vertically.
  - Important actions (Run, Improve, Save) are kept visible via sticky headers/footers where appropriate.

### 4.4 Error, Quota, and Validation Surfacing

- **Inline field errors**:
  - Creation and settings forms map `fieldErrors` from the API to specific inputs, with error text beneath fields.
- **Global toasts/banners**:
  - Quota exceeded (`QUOTA_EXCEEDED`), rate limiting (`RATE_LIMITED`), and OpenRouter gateway errors (`OPENROUTER_ERROR`) are surfaced via banners or toasts at the top of the workspace shell.
  - Quota-related banners show current usage and when actions will become available again if applicable.
- **Navigation guards**:
  - Unsaved changes in editors trigger confirmation dialogs on route changes and on Run/Improve actions.

## 5. Key Components

### 5.1 Cross-Cutting Components

- **AppShell**:
  - Wraps all authenticated views; includes sidebar, top bar, and content outlet.
  - Maps to auth-related user stories **US-001, US-002, US-021, US-022, US-026** and requirements **FR-001, FR-012, FR-013**.

- **SidebarNav**:
  - Renders primary sections and expandable catalog list.
  - Drives navigation and catalog-scoped filtering for Prompt List, supporting **US-007, US-008, US-028, US-029** and **FR-003, FR-004**.

- **TopBar**:
  - Hosts global search, quota summary, and user menu with sign out.
  - Supports **US-001, US-008, US-014, US-020, US-021, US-023, US-025**.

- **PromptTable / PromptListItem**:
  - Reusable table/list for prompts, used in Prompt List and potentially in Search Results.
  - Encapsulates row quick actions (Run, Open, More), supporting **US-003, US-004, US-005, US-008, US-009, US-029**.

- **PromptEditor**:
  - Central editor for prompt content with dirty-state tracking and character count.
  - Supports **US-003, US-004, US-017, US-018** and **FR-002, FR-024**.

- **CatalogSelector & TagSelector**:
  - Shared components for assigning catalogs and tags in Prompt Detail and New Prompt.
  - Provide inline “Create new” options that link to or leverage management endpoints, covering **US-006, US-007, US-008, US-028**.

- **RunButton & ImproveButton**:
  - Primary action buttons wired to corresponding endpoints, with integrated quota display and error handling.
  - Map to **US-009, US-010, US-011, US-014, US-020, US-023, US-025, US-027, US-030** and **FR-005, FR-006, FR-008, FR-011, FR-013**.

- **QuotaBadge / QuotaBanner**:
  - Small inline indicator and larger banner for quota and cost cap states based on `/api/quota` and error codes.
  - Support **US-014, US-020, US-023, US-025, US-027** and **FR-008, FR-011**.

- **RunsList & RunDetailPanel**:
  - List and detail components for runs in the Runs tab.
  - Support **US-009, US-010, US-017, US-020, US-027, US-029**.

- **VersionsList & VersionDetailPanel**:
  - Components for the Versions tab, including Restore actions.
  - Implement **US-004, US-012, US-013, US-020, US-025, US-030** and **FR-007**.

- **ImproveSuggestionsPanel**:
  - Panel/drawer showing suggested improved prompts and edit/save controls.
  - Central to **US-011, US-030** and **FR-006, FR-008, FR-011**.

- **SettingsForm**:
  - Retention selector and quota overview within Settings view.
  - Enables **US-013, US-014, US-020, US-023, US-025**.

- **ConfirmationDialogs (Delete, Restore, Unsaved Changes)**:
  - Reusable confirmation dialogs for destructive actions and navigation with unsaved changes.
  - Address **US-005, US-016, US-019, US-029** and **FR-010**.

- **Toast / Banner System**:
  - Centralized notification mechanism for non-field errors (quota, rate limit, OpenRouter, offline).
  - Supports **US-010, US-014, US-019, US-020, US-023, US-027** and **FR-011, FR-013**.

### 5.2 User Story Coverage Summary (US-001 – US-030)

- **US-001 – Sign in with Google OAuth**: Auth Gate, AppShell gating, TopBar user menu.
- **US-002 – Sign in with Email**: Auth Gate (same UI with alternate auth option).
- **US-003 – Create a New Prompt**: New Prompt view, PromptEditor, CatalogSelector, TagSelector, Prompt List refresh.
- **US-004 – Edit an Existing Prompt**: Prompt Detail – Overview, PromptEditor, Versions tab (new version on save).
- **US-005 – Delete a Prompt Permanently**: Delete actions in Prompt Detail and Prompt List, with ConfirmationDialogs.
- **US-006 – Create/Edit/Delete Tags**: Tags Management view and TagSelector in Prompt Detail/New Prompt.
- **US-007 – Create/Edit/Delete Catalogs**: Catalogs Management view and CatalogSelector in Prompt Detail/New Prompt.
- **US-008 – Full-text Search**: Global Search Results view and Prompt List local search.
- **US-009 – Run Prompt via Playground**: RunButton in Prompt Detail and row Run action in Prompt List.
- **US-010 – Handle OpenRouter Errors**: Run/Improve error handling via Toast/Banner System and inline messages.
- **US-011 – Improve Prompt with AI Suggestions**: ImproveButton, ImproveSuggestionsPanel, and version saving flow.
- **US-012 – Version History and Restore**: Versions tab with VersionsList, VersionDetailPanel, and Restore action.
- **US-013 – Version Retention Settings**: Settings view with retention selector and explanatory text.
- **US-014 – Quota Enforcement**: RunButton/ImproveButton integrated with QuotaBadge/Banner and `/api/quota`.
- **US-015 – Clipboard Export**: Copy action in Prompt Detail (Overview and Runs panels).
- **US-016 – Permanent Deletion Confirmation and Safety**: Delete ConfirmationDialogs and post-deletion navigation.
- **US-017 – Handling Large Prompts**: PromptEditor with character limits and warnings; Run/Improve disabling beyond safe size.
- **US-018 – Duplicate Prompt Detection (UX)**: New Prompt duplicate warning UI and flow control.
- **US-019 – Network and Offline Behavior**: Global offline banner, disabled Run/Improve/Save actions, unsaved-change handling.
- **US-020 – Logging for KPI Measurement**: UI triggers (Run, Improve, Save, Restore, Delete) are aligned with API events; no dedicated operator UI in MVP.
- **US-021 – Account Sign-out**: TopBar user menu with Sign out.
- **US-022 – Unauthorized Access Prevention**: Auth Gate and AppShell gating all resource views.
- **US-023 – Graceful OpenRouter Cost Limits**: QuotaBadge/Banner and error handling on cost cap responses.
- **US-024 – Input Validation and Sanitization**: Inline form validation in New Prompt, Prompt Detail metadata, Catalogs/Tags, and Settings.
- **US-025 – Analytics Events for User Flows**: UI flows are structured around the event types (run, improve, improve_saved, delete, restore) defined in the API, enabling instrumentation.
- **US-026 – Accessibility and Usability Basic Compliance**: Semantic structure, keyboard-accessible controls, ARIA labels, focus management, and responsive layouts across all views.
- **US-027 – Rate Limit Handling**: Toasts/banners with retry guidance on 429 responses surfaced in Prompt Detail and Prompt List.
- **US-028 – Prompt Listing and Pagination**: Prompt List, Catalogs Management, Tags Management, and Search Results with consistent pagination.
- **US-029 – Prompt Preview and Details**: Prompt List previews and Prompt Detail tabs (Overview, Runs, Versions).
- **US-030 – Confirmation of Improved Version Save Rate Tracking**: ImproveSuggestionsPanel and version save flows aligned with `improve_saved` events.

This UI architecture aligns the product’s functional and non-functional requirements with a coherent set of views, navigation patterns, and reusable components, ensuring compatibility with the REST API plan while emphasizing usability, accessibility, and security for the MVP. 


