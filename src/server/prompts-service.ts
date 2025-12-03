import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  CatalogId,
  CreatePromptCommand,
  CreatePromptResponseDto,
  ErrorDetails,
  DeletePromptCommand,
  PromptDetailDto,
  PromptEntity,
  PromptId,
  PromptLastRunSummaryDto,
  PromptListItemDto,
  PromptListResponseDto,
  PromptTagSummaryDto,
  PromptCurrentVersionDto,
  PromptRunStubDto,
  PromptVersionEntity,
  PromptVersionStubDto,
  UpdatePromptMetadataCommand,
  RunEntity,
  TagEntity,
  TagId,
  UserId,
} from "@/types"
import { ApiError } from "@/server/http-errors"
import * as tagsService from "@/server/tags-service"

type PromptRow = PromptEntity
type PromptVersionRow = PromptVersionEntity
type RunRow = RunEntity
type TagRow = TagEntity

interface ListForUserParams {
  page: number
  pageSize: number
  search?: string
  tagIds?: TagId[]
  catalogId?: CatalogId
  sort?:
    | "updatedAtDesc"
    | "createdAtDesc"
    | "titleAsc"
    | "lastRunDesc"
    | "relevance"
}

interface GetDetailForUserOptions {
  includeVersions?: boolean
  includeRuns?: boolean
}

/**
 * List prompts for a user with pagination, optional search, filtering, and
 * limited sorting. This function is intentionally conservative in its use of
 * joins to keep queries predictable and easy to reason about.
 */
export async function listForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  params: ListForUserParams,
): Promise<PromptListResponseDto> {
  const { page, pageSize, search, tagIds, catalogId } = params
  const sort = params.sort ?? "updatedAtDesc"

  const offset = (page - 1) * pageSize
  const to = offset + pageSize - 1

  // If tagIds filter is provided, pre-compute the set of prompt IDs that match
  // at least one of the tags for this user. If no prompts match, we can
  // short-circuit and avoid hitting the prompts table at all.
  let filterPromptIds: PromptId[] | undefined

  if (tagIds && tagIds.length > 0) {
    const { data: promptTags, error: promptTagsError } = await client
      .from("prompt_tags")
      .select("prompt_id")
      .eq("user_id", userId)
      .in("tag_id", tagIds)

    if (promptTagsError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] listForUser prompt_tags filter query failed",
        promptTagsError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to load prompts.",
      })
    }

    const uniquePromptIds = new Set<PromptId>()
    for (const row of promptTags ?? []) {
      if (row.prompt_id) {
        uniquePromptIds.add(row.prompt_id as PromptId)
      }
    }

    if (uniquePromptIds.size === 0) {
      return {
        items: [],
        page,
        pageSize,
        total: 0,
      }
    }

    filterPromptIds = Array.from(uniquePromptIds)
  }

  let query = client
    .from("prompts")
    .select("*", { count: "exact" })
    .eq("user_id", userId)

  if (catalogId) {
    query = query.eq("catalog_id", catalogId)
  }

  if (filterPromptIds) {
    query = query.in("id", filterPromptIds)
  }

  if (search && search.trim().length > 0) {
    // Use Postgres full-text search via Supabase textSearch on the stored
    // search_vector column. The underlying DB plan maintains this vector via
    // trigger, so we can rely on it here.
    query = query.textSearch("search_vector", search.trim(), {
      type: "websearch",
    })
  }

  switch (sort) {
    case "createdAtDesc":
      query = query.order("created_at", { ascending: false })
      break
    case "titleAsc":
      query = query.order("title", { ascending: true })
      break
    case "lastRunDesc":
      // For now we keep the DB sort simple and perform a best-effort
      // last-run-aware sort within the page in memory after we have both
      // prompts and runs loaded. This keeps the DB query straightforward while
      // still honoring the requested sort order at the page level.
      query = query.order("updated_at", { ascending: false })
      break
    case "relevance":
      // Supabase's textSearch already orders by relevance when used with
      // websearch; no explicit order is necessary. If search is not provided,
      // fall back to updatedAtDesc semantics.
      if (!search || search.trim().length === 0) {
        query = query.order("updated_at", { ascending: false })
      }
      break
    case "updatedAtDesc":
    default:
      query = query.order("updated_at", { ascending: false })
      break
  }

  const { data, count, error } = await query.range(offset, to)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[prompts-service] listForUser prompts query failed", error)

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompts.",
    })
  }

  const promptRows = (data ?? []) as PromptRow[]

  if (promptRows.length === 0) {
    return {
      items: [],
      page,
      pageSize,
      total: count ?? 0,
    }
  }

  const promptIds = promptRows.map((row) => row.id as PromptId)

  // Load last run summaries for prompts that have a last_run_id.
  const lastRunIdSet = new Set<string>()
  for (const row of promptRows) {
    if (row.last_run_id) {
      lastRunIdSet.add(row.last_run_id)
    }
  }

  const lastRunSummaries = await loadLastRunSummaries(
    client,
    userId,
    lastRunIdSet,
  )

  // Load tag summaries for all prompts in the current page.
  const tagSummariesByPromptId = await loadTagSummariesForPrompts(
    client,
    userId,
    promptIds,
  )

  let items: PromptListItemDto[] = promptRows.map((row) =>
    mapPromptRowToListItemDto(
      row,
      tagSummariesByPromptId.get(row.id as PromptId) ?? [],
      row.last_run_id ? lastRunSummaries.get(row.last_run_id) ?? null : null,
    ),
  )

  // Apply in-memory sort adjustments for lastRunDesc where we have the data
  // necessary to do so accurately within the current page.
  if (sort === "lastRunDesc") {
    items = items.slice().sort((a, b) => {
      const aTime = a.lastRun?.createdAt ?? ""
      const bTime = b.lastRun?.createdAt ?? ""
      if (!aTime && !bTime) return 0
      if (!aTime) return 1
      if (!bTime) return -1
      return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
    })
  }

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

/**
 * Create a new prompt and its initial version for the user, optionally
 * assigning it to a catalog and a set of tags.
 */
export async function createForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  command: CreatePromptCommand,
): Promise<CreatePromptResponseDto> {
  const catalogId = command.catalogId ?? null
  const tagIds = command.tagIds ?? []

  if (catalogId) {
    const { data: catalog, error: catalogError } = await client
      .from("catalogs")
      .select("id")
      .eq("id", catalogId)
      .eq("user_id", userId)
      .maybeSingle()

    if (catalogError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] createForUser catalog lookup failed",
        catalogError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate catalog.",
      })
    }

    if (!catalog) {
      const fieldErrors: ErrorDetails["fieldErrors"] = {
        catalogId: ["Catalog does not exist or is not owned by the user."],
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Catalog ID is invalid.",
        details: { fieldErrors },
      })
    }
  }

  let uniqueTagIds: TagId[] = []

  if (tagIds.length > 0) {
    uniqueTagIds = Array.from(new Set(tagIds))

    const { data: tags, error: tagsError } = await client
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .in("id", uniqueTagIds)

    if (tagsError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] createForUser tags lookup failed",
        tagsError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate tags.",
      })
    }

    const foundIds = new Set((tags ?? []).map((row) => row.id as TagId))

    if (foundIds.size !== uniqueTagIds.length) {
      const fieldErrors: ErrorDetails["fieldErrors"] = {
        tagIds: ["One or more tags do not exist or are not owned by the user."],
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Tag IDs are invalid.",
        details: { fieldErrors },
      })
    }
  }

  const { data: promptInsertData, error: promptInsertError } = await client
    .from("prompts")
    .insert({
      user_id: userId,
      catalog_id: catalogId,
      title: command.title,
    })
    .select()
    .single()

  if (promptInsertError || !promptInsertData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] createForUser prompts insert failed",
      promptInsertError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create prompt.",
    })
  }

  const promptRow = promptInsertData as PromptRow

  const { data: versionInsertData, error: versionInsertError } = await client
    .from("prompt_versions")
    .insert({
      prompt_id: promptRow.id,
      user_id: userId,
      title: command.title,
      content: command.content,
      summary: command.summary ?? null,
      created_by: userId,
    })
    .select()
    .single()

  if (versionInsertError || !versionInsertData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] createForUser prompt_versions insert failed",
      versionInsertError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create prompt version.",
    })
  }

  const versionRow = versionInsertData as PromptVersionRow

  const nowIso = new Date().toISOString()

  const { data: promptUpdateData, error: promptUpdateError } = await client
    .from("prompts")
    .update({
      current_version_id: versionRow.id,
      updated_at: nowIso,
    })
    .eq("id", promptRow.id)
    .eq("user_id", userId)
    .select()
    .single()

  if (promptUpdateError || !promptUpdateData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] createForUser prompts update failed",
      promptUpdateError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to finalize prompt creation.",
    })
  }

  const finalPromptRow = promptUpdateData as PromptRow

  if (uniqueTagIds.length > 0) {
    const rows = uniqueTagIds.map((tagId) => ({
      prompt_id: finalPromptRow.id,
      tag_id: tagId,
      user_id: userId,
    }))

    const { error: promptTagsInsertError } = await client
      .from("prompt_tags")
      .insert(rows)

    if (promptTagsInsertError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] createForUser prompt_tags insert failed",
        promptTagsInsertError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to assign tags to prompt.",
      })
    }
  }

  const tagSummariesByPromptId = await loadTagSummariesForPrompts(client, userId, [
    finalPromptRow.id as PromptId,
  ])

  const promptDto = mapPromptRowToListItemDto(
    finalPromptRow,
    tagSummariesByPromptId.get(finalPromptRow.id as PromptId) ?? [],
    null,
  )

  const versionDto: PromptCurrentVersionDto = {
    id: versionRow.id as PromptCurrentVersionDto["id"],
    title: versionRow.title,
    content: versionRow.content,
    summary: versionRow.summary,
    createdAt: versionRow.created_at,
  }

  const response: CreatePromptResponseDto = {
    prompt: promptDto,
    version: versionDto,
    // duplicateWarning is intentionally omitted for now; a future iteration can
    // populate it based on similarity checks against existing prompts.
  }

  return response
}

/**
 * Get full prompt detail for a user, including metadata, current version,
 * last run, and optionally recent versions and runs.
 */
export async function getDetailForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  options?: GetDetailForUserOptions,
): Promise<PromptDetailDto> {
  const { data: promptData, error: promptError } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] getDetailForUser prompt select failed",
      promptError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!promptData) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  const promptRow = promptData as PromptRow

  const tagSummariesByPromptId = await loadTagSummariesForPrompts(client, userId, [
    promptRow.id as PromptId,
  ])

  const tags = tagSummariesByPromptId.get(promptRow.id as PromptId) ?? []

  let currentVersion: PromptCurrentVersionDto | null = null

  if (promptRow.current_version_id) {
    const { data: versionData, error: versionError } = await client
      .from("prompt_versions")
      .select("*")
      .eq("id", promptRow.current_version_id)
      .eq("user_id", userId)
      .maybeSingle()

    if (versionError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] getDetailForUser current version select failed",
        versionError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to load prompt version.",
      })
    }

    if (versionData) {
      const versionRow = versionData as PromptVersionRow
      currentVersion = {
        id: versionRow.id as PromptCurrentVersionDto["id"],
        title: versionRow.title,
        content: versionRow.content,
        summary: versionRow.summary,
        createdAt: versionRow.created_at,
      }
    }
  }

  let lastRun: PromptLastRunSummaryDto | null = null

  if (promptRow.last_run_id) {
    const lastRunMap = await loadLastRunSummaries(
      client,
      userId,
      new Set([promptRow.last_run_id]),
    )
    lastRun = lastRunMap.get(promptRow.last_run_id) ?? null
  }

  let versions: PromptVersionStubDto[] | undefined
  if (options?.includeVersions) {
    const { data: versionsData, error: versionsError } = await client
      .from("prompt_versions")
      .select("*")
      .eq("prompt_id", promptRow.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (versionsError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] getDetailForUser versions select failed",
        versionsError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to load prompt versions.",
      })
    }

    versions = (versionsData ?? []).map((row) => {
      const versionRow = row as PromptVersionRow
      const stub: PromptVersionStubDto = {
        id: versionRow.id as PromptVersionStubDto["id"],
        title: versionRow.title,
        summary: versionRow.summary,
        createdAt: versionRow.created_at,
      }
      return stub
    })
  }

  let runs: PromptRunStubDto[] | undefined
  if (options?.includeRuns) {
    const { data: runsData, error: runsError } = await client
      .from("runs")
      .select("id, status, created_at")
      .eq("prompt_id", promptRow.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (runsError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] getDetailForUser runs select failed",
        runsError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to load prompt runs.",
      })
    }

    runs = (runsData ?? []).map((row) => {
      const stub: PromptRunStubDto = {
        id: row.id as PromptRunStubDto["id"],
        status: row.status,
        createdAt: row.created_at,
      }
      return stub
    })
  }

  const dto: PromptDetailDto = {
    id: promptRow.id as PromptId,
    title: promptRow.title,
    catalogId: (promptRow.catalog_id ?? null) as CatalogId | null,
    tags,
    currentVersion,
    lastRun,
    createdAt: promptRow.created_at,
    updatedAt: promptRow.updated_at,
  }

  if (versions !== undefined) {
    dto.versions = versions
  }

  if (runs !== undefined) {
    dto.runs = runs
  }

  return dto
}

function mapPromptRowToListItemDto(
  row: PromptRow,
  tags: PromptTagSummaryDto[],
  lastRun: PromptLastRunSummaryDto | null,
): PromptListItemDto {
  const id = row.id as PromptId

  return {
    id,
    title: row.title,
    catalogId: (row.catalog_id ?? null) as CatalogId | null,
    tags,
    currentVersionId: (row.current_version_id ?? null) as PromptRow["current_version_id"],
    lastRun,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Update prompt metadata (title, catalog, tags) for the user and return the
 * updated detail representation.
 */
export async function updateMetadataForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  command: UpdatePromptMetadataCommand,
): Promise<PromptDetailDto> {
  const { data: existingPrompt, error: existingError } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] updateMetadataForUser prompt select failed",
      existingError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!existingPrompt) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  const promptRow = existingPrompt as PromptRow

  const updates: Record<string, unknown> = {}

  if (command.title !== undefined) {
    updates.title = command.title
  }

  if (command.catalogId !== undefined) {
    updates.catalog_id = command.catalogId
  }

  if (Object.keys(updates).length > 0) {
    const nowIso = new Date().toISOString()

    const { error: catalogCheckError } = await validateCatalogForUpdate(
      client,
      userId,
      command.catalogId,
    )

    if (catalogCheckError) {
      throw catalogCheckError
    }

    const { error: updateError } = await client
      .from("prompts")
      .update({
        ...updates,
        updated_at: nowIso,
      })
      .eq("id", promptRow.id)
      .eq("user_id", userId)

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompts-service] updateMetadataForUser prompts update failed",
        updateError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to update prompt.",
      })
    }
  }

  if (command.tagIds !== undefined) {
    await tagsService.replacePromptTags(client, userId, promptId, {
      tagIds: command.tagIds,
    })
  }

  return getDetailForUser(client, userId, promptId, {
    includeVersions: false,
    includeRuns: false,
  })
}

/**
 * Delete a prompt and its dependent data for the user, logging a delete event
 * for analytics. The confirmation flag is expected to be validated at the API
 * layer; this function focuses on existence, logging, and deletion.
 */
export async function deleteForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  _command?: DeletePromptCommand,
): Promise<void> {
  const { data: existingPrompt, error: existingError } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] deleteForUser prompt select failed",
      existingError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!existingPrompt) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  // Log the delete event before deleting the prompt so the foreign key can
  // still reference it; ON DELETE SET NULL will then keep analytics rows valid
  // even after deletion.
  const { error: runEventError } = await client.from("run_events").insert({
    user_id: userId,
    prompt_id: promptId,
    event_type: "delete",
    payload: null,
  })

  if (runEventError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] deleteForUser run_events insert failed",
      runEventError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to log prompt deletion.",
    })
  }

  const { error: deleteError } = await client
    .from("prompts")
    .delete()
    .eq("id", promptId)
    .eq("user_id", userId)

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] deleteForUser prompts delete failed",
      deleteError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to delete prompt.",
    })
  }
}

async function validateCatalogForUpdate(
  client: SupabaseClient<Database>,
  userId: UserId,
  catalogId: CatalogId | null | undefined,
): Promise<{ error?: ApiError }> {
  if (catalogId === undefined || catalogId === null) {
    return {}
  }

  const { data: catalog, error: catalogError } = await client
    .from("catalogs")
    .select("id")
    .eq("id", catalogId)
    .eq("user_id", userId)
    .maybeSingle()

  if (catalogError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] validateCatalogForUpdate catalog select failed",
      catalogError,
    )

    return {
      error: new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate catalog.",
      }),
    }
  }

  if (!catalog) {
    const fieldErrors: ErrorDetails["fieldErrors"] = {
      catalogId: ["Catalog does not exist or is not owned by the user."],
    }

    return {
      error: new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Catalog ID is invalid.",
        details: { fieldErrors },
      }),
    }
  }

  return {}
}

async function loadLastRunSummaries(
  client: SupabaseClient<Database>,
  userId: UserId,
  lastRunIdSet: Set<string>,
): Promise<Map<string, PromptLastRunSummaryDto>> {
  const map = new Map<string, PromptLastRunSummaryDto>()

  if (lastRunIdSet.size === 0) {
    return map
  }

  const lastRunIds = Array.from(lastRunIdSet)

  const { data, error } = await client
    .from("runs")
    .select("*")
    .eq("user_id", userId)
    .in("id", lastRunIds)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[prompts-service] loadLastRunSummaries query failed", error)

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt run summaries.",
    })
  }

  for (const row of (data ?? []) as RunRow[]) {
    const dto: PromptLastRunSummaryDto = {
      id: row.id as PromptLastRunSummaryDto["id"],
      status: row.status,
      createdAt: row.created_at,
      model: row.model,
      latencyMs: row.latency_ms,
    }

    map.set(row.id, dto)
  }

  return map
}

async function loadTagSummariesForPrompts(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptIds: PromptId[],
): Promise<Map<PromptId, PromptTagSummaryDto[]>> {
  const result = new Map<PromptId, PromptTagSummaryDto[]>()

  if (promptIds.length === 0) {
    return result
  }

  const { data: promptTags, error: promptTagsError } = await client
    .from("prompt_tags")
    .select("prompt_id, tag_id")
    .eq("user_id", userId)
    .in("prompt_id", promptIds)

  if (promptTagsError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] loadTagSummariesForPrompts prompt_tags query failed",
      promptTagsError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt tags.",
    })
  }

  const tagIdSet = new Set<TagId>()
  for (const row of promptTags ?? []) {
    if (row.tag_id) {
      tagIdSet.add(row.tag_id as TagId)
    }
  }

  if (tagIdSet.size === 0) {
    return result
  }

  const tagIds = Array.from(tagIdSet)

  const { data: tags, error: tagsError } = await client
    .from("tags")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", tagIds)

  if (tagsError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompts-service] loadTagSummariesForPrompts tags query failed",
      tagsError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load tags.",
    })
  }

  const tagById = new Map<TagId, TagRow>()
  for (const row of (tags ?? []) as TagRow[]) {
    tagById.set(row.id as TagId, row)
  }

  for (const row of promptTags ?? []) {
    const promptId = row.prompt_id as PromptId
    const tagId = row.tag_id as TagId
    const tagRow = tagById.get(tagId)
    if (!tagRow) {
      continue
    }

    const dto: PromptTagSummaryDto = {
      id: tagRow.id as TagId,
      name: tagRow.name,
    }

    const existing = result.get(promptId)
    if (existing) {
      existing.push(dto)
    } else {
      result.set(promptId, [dto])
    }
  }

  return result
}



