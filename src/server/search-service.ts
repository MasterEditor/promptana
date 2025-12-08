import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  CatalogId,
  PromptEntity,
  PromptId,
  PromptTagSummaryDto,
  PromptVersionEntity,
  SearchPromptResultItemDto,
  SearchPromptsResponseDto,
  TagEntity,
  TagId,
  UserId,
} from "@/types"
import { ApiError } from "@/server/http-errors"

/**
 * Query parameters after validation for the search endpoint.
 */
export interface SearchPromptsParams {
  q: string
  tagIds?: TagId[]
  catalogId?: CatalogId
  page: number
  pageSize: number
  sort: "relevance" | "updatedAtDesc"
}

type PromptRow = PromptEntity
type PromptVersionRow = PromptVersionEntity
type TagRow = TagEntity

/**
 * Search prompts for a user using PostgreSQL full-text search.
 *
 * This function performs a full-text search across prompt titles and content,
 * with optional filtering by tags and catalog. Results include relevance scores
 * and contextual snippets.
 */
export async function searchForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  params: SearchPromptsParams,
): Promise<SearchPromptsResponseDto> {
  const { q, tagIds, catalogId, page, pageSize, sort } = params
  const offset = (page - 1) * pageSize

  // Step 2: If tagIds filter is provided, pre-compute the set of prompt IDs
  // that match at least one of the tags for this user.
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
        "[search-service] searchForUser prompt_tags filter query failed",
        promptTagsError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to search prompts.",
      })
    }

    const uniquePromptIds = new Set<PromptId>()
    for (const row of promptTags ?? []) {
      if (row.prompt_id) {
        uniquePromptIds.add(row.prompt_id as PromptId)
      }
    }

    // Short-circuit if no prompts match the tag filter
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

  // Step 3: Build the full-text search query using Supabase's textSearch
  let query = client
    .from("prompts")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .textSearch("search_vector", q, { type: "websearch" })

  // Apply catalog filter if provided
  if (catalogId) {
    query = query.eq("catalog_id", catalogId)
  }

  // Apply tag-based prompt ID filter if computed
  if (filterPromptIds) {
    query = query.in("id", filterPromptIds)
  }

  // Apply sorting
  // Note: Supabase's textSearch with websearch type orders by relevance by default
  // when no explicit order is specified. For updatedAtDesc, we override this.
  if (sort === "updatedAtDesc") {
    query = query.order("updated_at", { ascending: false })
  } else {
    // For relevance sorting, we still apply updated_at as a secondary sort
    // to ensure consistent ordering for results with equal relevance
    query = query.order("updated_at", { ascending: false })
  }

  const { data, count, error } = await query.range(offset, offset + pageSize - 1)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[search-service] searchForUser prompts query failed", error)

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to search prompts.",
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

  // Load current version content for snippet generation
  const currentVersionIds = promptRows
    .filter((row) => row.current_version_id)
    .map((row) => row.current_version_id as string)

  const versionContentMap = await loadVersionContent(
    client,
    userId,
    currentVersionIds,
  )

  // Load catalog information for prompts that have a catalog_id
  const catalogIds = promptRows
    .filter((row) => row.catalog_id)
    .map((row) => row.catalog_id as string)

  const catalogMap = await loadCatalogs(client, userId, catalogIds)

  // Load tag summaries for all prompts in the result set
  const tagSummariesByPromptId = await loadTagSummariesForPrompts(
    client,
    userId,
    promptIds,
  )

  // Map results to DTOs with snippets and scores
  const items: SearchPromptResultItemDto[] = promptRows.map((row, index) => {
    const content = row.current_version_id
      ? versionContentMap.get(row.current_version_id) ?? ""
      : ""

    const catalog = row.catalog_id
      ? catalogMap.get(row.catalog_id) ?? null
      : null

    return {
      id: row.id as PromptId,
      title: row.title,
      snippet: generateSnippet(content, q),
      // Approximate score based on result order since Supabase's textSearch
      // returns results ordered by relevance. Higher index = lower score.
      score: Math.max(0, 1 - index * 0.05),
      catalog,
      tags: tagSummariesByPromptId.get(row.id as PromptId) ?? [],
      updatedAt: row.updated_at,
    }
  })

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

/**
 * Load prompt version content for a list of version IDs.
 */
async function loadVersionContent(
  client: SupabaseClient<Database>,
  userId: UserId,
  versionIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  if (versionIds.length === 0) {
    return map
  }

  const { data, error } = await client
    .from("prompt_versions")
    .select("id, content")
    .eq("user_id", userId)
    .in("id", versionIds)

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[search-service] loadVersionContent query failed",
      error,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to search prompts.",
    })
  }

  for (const row of (data ?? []) as PromptVersionRow[]) {
    map.set(row.id, row.content)
  }

  return map
}

/**
 * Load catalog information for a list of catalog IDs.
 */
async function loadCatalogs(
  client: SupabaseClient<Database>,
  userId: UserId,
  catalogIds: string[],
): Promise<Map<string, { id: CatalogId; name: string }>> {
  const map = new Map<string, { id: CatalogId; name: string }>()

  if (catalogIds.length === 0) {
    return map
  }

  const uniqueCatalogIds = [...new Set(catalogIds)]

  const { data, error } = await client
    .from("catalogs")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", uniqueCatalogIds)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[search-service] loadCatalogs query failed", error)

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to search prompts.",
    })
  }

  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id as CatalogId,
      name: row.name,
    })
  }

  return map
}

/**
 * Load tag summaries for a list of prompt IDs.
 * This follows the same pattern as prompts-service.ts.
 */
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
      "[search-service] loadTagSummariesForPrompts prompt_tags query failed",
      promptTagsError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to search prompts.",
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
      "[search-service] loadTagSummariesForPrompts tags query failed",
      tagsError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to search prompts.",
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

/**
 * Generate a contextual snippet from content based on the search query.
 *
 * This function finds the first occurrence of any query term in the content
 * and extracts a surrounding snippet with the matches highlighted using <b> tags.
 */
function generateSnippet(
  content: string,
  query: string,
  maxLength = 200,
): string {
  if (!content || content.length === 0) {
    return ""
  }

  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Split query into terms, filtering out common stop words and empty strings
  const queryTerms = lowerQuery
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .slice(0, 10) // Limit to first 10 terms

  // Find the position of the first matching term
  let startIndex = 0
  for (const term of queryTerms) {
    const idx = lowerContent.indexOf(term)
    if (idx !== -1) {
      // Center the snippet around the match
      startIndex = Math.max(0, idx - 50)
      break
    }
  }

  // Extract the snippet
  let snippet = content.slice(startIndex, startIndex + maxLength)

  // Add ellipsis if we're not at the start
  if (startIndex > 0) {
    // Try to start at a word boundary
    const firstSpace = snippet.indexOf(" ")
    if (firstSpace > 0 && firstSpace < 20) {
      snippet = snippet.slice(firstSpace + 1)
    }
    snippet = "..." + snippet
  }

  // Add ellipsis if we're not at the end
  if (startIndex + maxLength < content.length) {
    // Try to end at a word boundary
    const lastSpace = snippet.lastIndexOf(" ")
    if (lastSpace > snippet.length - 30) {
      snippet = snippet.slice(0, lastSpace)
    }
    snippet = snippet + "..."
  }

  // Highlight matches with <b> tags
  for (const term of queryTerms) {
    if (term.length === 0) continue
    const escapedTerm = escapeRegex(term)
    const regex = new RegExp(`(${escapedTerm})`, "gi")
    snippet = snippet.replace(regex, "<b>$1</b>")
  }

  return snippet
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

