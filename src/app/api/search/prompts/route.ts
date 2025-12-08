import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CatalogId,
  ErrorDetails,
  ErrorResponseDto,
  SearchPromptsResponseDto,
  TagId,
} from "@/types"
import { handleRouteError } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as searchService from "@/server/search-service"

type SearchSuccessResponse = SearchPromptsResponseDto
type SearchErrorResponse = ErrorResponseDto

const MAX_QUERY_LENGTH = 500
const MAX_TAG_IDS = 50
const MAX_PAGE_SIZE = 50
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

type SortOption = "relevance" | "updatedAtDesc"

/**
 * GET /api/search/prompts
 *
 * Full-text search across prompts for the authenticated user.
 * Searches prompt titles, content (latest version), and catalog names
 * using PostgreSQL's tsvector and GIN index.
 *
 * Query Parameters:
 * - q (required): Search query string
 * - tagIds (optional): Comma-separated UUIDs to filter by tags
 * - catalogId (optional): UUID to filter by catalog
 * - page (optional, default 1): Page number
 * - pageSize (optional, default 20, max 50): Results per page
 * - sort (optional, default "relevance"): "relevance" or "updatedAtDesc"
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<SearchSuccessResponse | SearchErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/search/prompts",
    })

    const params = validateSearchQuery(request.nextUrl.searchParams)

    const dto = await searchService.searchForUser(client, userId, params)

    return NextResponse.json<SearchSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<SearchSuccessResponse, SearchErrorResponse>(
      error,
      "/api/search/prompts",
    )
  }
}

/**
 * Validate and parse search query parameters.
 *
 * Throws ApiError with 400 status if validation fails.
 */
function validateSearchQuery(
  searchParams: URLSearchParams,
): searchService.SearchPromptsParams {
  const rawQ = searchParams.get("q")
  const rawTagIds = searchParams.get("tagIds")
  const rawCatalogId = searchParams.get("catalogId")
  const rawPage = searchParams.get("page")
  const rawPageSize = searchParams.get("pageSize")
  const rawSort = searchParams.get("sort")

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  // q (required)
  if (rawQ === null || rawQ.trim().length === 0) {
    fieldErrors.q = ["Field is required."]
  } else if (rawQ.length > MAX_QUERY_LENGTH) {
    fieldErrors.q = [`Must be at most ${MAX_QUERY_LENGTH} characters long.`]
  }

  // tagIds (optional, comma-separated UUIDs)
  let tagIds: TagId[] | undefined
  if (rawTagIds !== null && rawTagIds.trim().length > 0) {
    const parts = rawTagIds
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (parts.length > MAX_TAG_IDS) {
      fieldErrors.tagIds = [
        `Must not contain more than ${MAX_TAG_IDS} tag IDs.`,
      ]
    }

    const validIds: TagId[] = []
    let hasInvalidUuid = false

    for (const part of parts) {
      if (!UUID_REGEX.test(part)) {
        hasInvalidUuid = true
        break
      }
      validIds.push(part as TagId)
    }

    if (hasInvalidUuid) {
      fieldErrors.tagIds = [
        ...(fieldErrors.tagIds ?? []),
        "All tagIds must be valid UUID strings.",
      ]
    }

    if (validIds.length > 0 && !fieldErrors.tagIds) {
      // Deduplicate tag IDs
      tagIds = [...new Set(validIds)]
    }
  }

  // catalogId (optional UUID)
  let catalogId: CatalogId | undefined
  if (rawCatalogId !== null) {
    if (!UUID_REGEX.test(rawCatalogId)) {
      fieldErrors.catalogId = ["Must be a valid UUID string."]
    } else {
      catalogId = rawCatalogId as CatalogId
    }
  }

  // page
  let page = 1
  if (rawPage !== null) {
    const parsed = Number(rawPage)
    if (!Number.isInteger(parsed)) {
      fieldErrors.page = ["Must be an integer."]
    } else if (parsed < 1) {
      fieldErrors.page = ["Must be greater than or equal to 1."]
    } else {
      page = parsed
    }
  }

  // pageSize
  let pageSize = 20
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize)
    if (!Number.isInteger(parsed)) {
      fieldErrors.pageSize = ["Must be an integer."]
    } else if (parsed < 1 || parsed > MAX_PAGE_SIZE) {
      fieldErrors.pageSize = [`Must be between 1 and ${MAX_PAGE_SIZE}.`]
    } else {
      pageSize = parsed
    }
  }

  // sort
  let sort: SortOption = "relevance"
  if (rawSort !== null) {
    if (rawSort !== "relevance" && rawSort !== "updatedAtDesc") {
      fieldErrors.sort = ["Must be one of relevance or updatedAtDesc."]
    } else {
      sort = rawSort as SortOption
    }
  }

  // Throw if there are any validation errors
  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Query parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return {
    q: rawQ!.trim(),
    tagIds,
    catalogId,
    page,
    pageSize,
    sort,
  }
}

