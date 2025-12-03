import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CatalogId,
  CreatePromptCommand,
  CreatePromptResponseDto,
  ErrorDetails,
  ErrorResponseDto,
  PromptListResponseDto,
  TagId,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as promptsService from "@/server/prompts-service"

type PromptsListSuccessResponse = PromptListResponseDto
type PromptsCreateSuccessResponse = CreatePromptResponseDto
type PromptsErrorResponse = ErrorResponseDto

const MAX_SEARCH_LENGTH = 500
const MAX_TAG_IDS = 50
const PROMPT_TITLE_MAX_LENGTH = 255
const PROMPT_CONTENT_MAX_LENGTH = 100_000
const PROMPT_SUMMARY_MAX_LENGTH = 1_000

type SortOption =
  | "updatedAtDesc"
  | "createdAtDesc"
  | "titleAsc"
  | "lastRunDesc"
  | "relevance"

/**
 * GET /api/prompts
 *
 * List prompts for the authenticated user with pagination, optional search,
 * filtering by catalog and tags, and basic sorting.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<PromptsListSuccessResponse | PromptsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts",
    })

    const { page, pageSize, search, tagIds, catalogId, sort } =
      validateListPromptsQuery(request.nextUrl.searchParams)

    const dto = await promptsService.listForUser(client, userId, {
      page,
      pageSize,
      search,
      tagIds,
      catalogId,
      sort,
    })

    return NextResponse.json<PromptsListSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<PromptsListSuccessResponse, PromptsErrorResponse>(
      error,
      "/api/prompts",
    )
  }
}

/**
 * POST /api/prompts
 *
 * Create a new prompt and its initial content version for the authenticated
 * user, optionally assigning it to a catalog and tags.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<PromptsCreateSuccessResponse | PromptsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateCreatePromptBody(rawBody)

    const dto = await promptsService.createForUser(client, userId, command)

    return NextResponse.json<PromptsCreateSuccessResponse>(dto, {
      status: 201,
    })
  } catch (error) {
    return handleRouteError<PromptsCreateSuccessResponse, PromptsErrorResponse>(
      error,
      "/api/prompts",
    )
  }
}

function validateListPromptsQuery(
  searchParams: URLSearchParams,
): {
  page: number
  pageSize: number
  search?: string
  tagIds?: TagId[]
  catalogId?: CatalogId
  sort?: SortOption
} {
  const rawPage = searchParams.get("page")
  const rawPageSize = searchParams.get("pageSize")
  const rawSearch = searchParams.get("search")
  const rawTagIds = searchParams.get("tagIds")
  const rawCatalogId = searchParams.get("catalogId")
  const rawSort = searchParams.get("sort")

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

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
    } else if (parsed < 1 || parsed > 100) {
      fieldErrors.pageSize = ["Must be between 1 and 100."]
    } else {
      pageSize = parsed
    }
  }

  // search
  let search: string | undefined
  if (rawSearch !== null) {
    if (rawSearch.length > MAX_SEARCH_LENGTH) {
      fieldErrors.search = [
        `Must be at most ${MAX_SEARCH_LENGTH} characters long.`,
      ]
    } else {
      search = rawSearch
    }
  }

  // tagIds – comma-separated UUIDs
  let tagIds: TagId[] | undefined
  if (rawTagIds !== null && rawTagIds.trim().length > 0) {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

    const parts = rawTagIds
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    if (parts.length > MAX_TAG_IDS) {
      fieldErrors.tagIds = [
        ...(fieldErrors.tagIds ?? []),
        `Must not contain more than ${MAX_TAG_IDS} tag IDs.`,
      ]
    }

    const seen = new Set<string>()
    const parsedIds: TagId[] = []

    for (const value of parts) {
      if (!uuidRegex.test(value)) {
        fieldErrors.tagIds = [
          ...(fieldErrors.tagIds ?? []),
          "All tagIds must be valid UUID strings.",
        ]
        break
      }

      if (!seen.has(value)) {
        seen.add(value)
        parsedIds.push(value as TagId)
      }
    }

    if (parsedIds.length > 0) {
      tagIds = parsedIds
    }
  }

  // catalogId – optional UUID
  let catalogId: CatalogId | undefined
  if (rawCatalogId !== null) {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

    if (!uuidRegex.test(rawCatalogId)) {
      fieldErrors.catalogId = ["Must be a valid UUID string."]
    } else {
      catalogId = rawCatalogId as CatalogId
    }
  }

  // sort
  let sort: SortOption | undefined
  if (rawSort !== null) {
    const allowed: SortOption[] = [
      "updatedAtDesc",
      "createdAtDesc",
      "titleAsc",
      "lastRunDesc",
      "relevance",
    ]

    if (!allowed.includes(rawSort as SortOption)) {
      fieldErrors.sort = [
        "Must be one of updatedAtDesc, createdAtDesc, titleAsc, lastRunDesc, or relevance.",
      ]
    } else {
      sort = rawSort as SortOption
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Query parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return { page, pageSize, search, tagIds, catalogId, sort }
}

function validateCreatePromptBody(payload: unknown): CreatePromptCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set([
    "title",
    "content",
    "catalogId",
    "tagIds",
    "summary",
  ])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawTitle = body.title
  const rawContent = body.content
  const rawCatalogId = body.catalogId
  const rawTagIds = body.tagIds
  const rawSummary = body.summary

  // title – required string
  if (rawTitle === undefined) {
    structuralFieldErrors.title = [
      ...(structuralFieldErrors.title ?? []),
      "Field is required.",
    ]
  } else if (typeof rawTitle !== "string") {
    structuralFieldErrors.title = [
      ...(structuralFieldErrors.title ?? []),
      "Must be a string.",
    ]
  } else {
    const trimmed = rawTitle.trim()

    if (trimmed.length === 0) {
      semanticFieldErrors.title = [
        ...(semanticFieldErrors.title ?? []),
        "Must not be empty.",
      ]
    } else if (trimmed.length > PROMPT_TITLE_MAX_LENGTH) {
      semanticFieldErrors.title = [
        ...(semanticFieldErrors.title ?? []),
        `Must be at most ${PROMPT_TITLE_MAX_LENGTH} characters long.`,
      ]
    }
  }

  // content – required string
  if (rawContent === undefined) {
    structuralFieldErrors.content = [
      ...(structuralFieldErrors.content ?? []),
      "Field is required.",
    ]
  } else if (typeof rawContent !== "string") {
    structuralFieldErrors.content = [
      ...(structuralFieldErrors.content ?? []),
      "Must be a string.",
    ]
  } else {
    if (rawContent.length === 0) {
      semanticFieldErrors.content = [
        ...(semanticFieldErrors.content ?? []),
        "Must not be empty.",
      ]
    } else if (rawContent.length > PROMPT_CONTENT_MAX_LENGTH) {
      semanticFieldErrors.content = [
        ...(semanticFieldErrors.content ?? []),
        `Must be at most ${PROMPT_CONTENT_MAX_LENGTH} characters long.`,
      ]
    }
  }

  // summary – optional string or null
  if (rawSummary !== undefined && rawSummary !== null) {
    if (typeof rawSummary !== "string") {
      structuralFieldErrors.summary = [
        ...(structuralFieldErrors.summary ?? []),
        "Must be a string or null.",
      ]
    } else if (rawSummary.length > PROMPT_SUMMARY_MAX_LENGTH) {
      semanticFieldErrors.summary = [
        ...(semanticFieldErrors.summary ?? []),
        `Must be at most ${PROMPT_SUMMARY_MAX_LENGTH} characters long.`,
      ]
    }
  }

  // catalogId – optional UUID or null
  if (rawCatalogId !== undefined && rawCatalogId !== null) {
    if (typeof rawCatalogId !== "string") {
      structuralFieldErrors.catalogId = [
        ...(structuralFieldErrors.catalogId ?? []),
        "Must be a string or null.",
      ]
    } else {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

      if (!uuidRegex.test(rawCatalogId)) {
        structuralFieldErrors.catalogId = [
          ...(structuralFieldErrors.catalogId ?? []),
          "Must be a valid UUID string.",
        ]
      }
    }
  }

  // tagIds – optional array of UUIDs
  if (rawTagIds !== undefined) {
    if (!Array.isArray(rawTagIds)) {
      structuralFieldErrors.tagIds = [
        ...(structuralFieldErrors.tagIds ?? []),
        "Must be an array of tag IDs.",
      ]
    } else {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

      if (rawTagIds.length > MAX_TAG_IDS) {
        semanticFieldErrors.tagIds = [
          ...(semanticFieldErrors.tagIds ?? []),
          `Must not contain more than ${MAX_TAG_IDS} tag IDs.`,
        ]
      }

      const seen = new Set<string>()
      let hasInvalidElement = false
      let hasDuplicate = false

      for (const value of rawTagIds) {
        if (typeof value !== "string" || !uuidRegex.test(value)) {
          hasInvalidElement = true
          continue
        }

        if (seen.has(value)) {
          hasDuplicate = true
        } else {
          seen.add(value)
        }
      }

      if (hasInvalidElement) {
        structuralFieldErrors.tagIds = [
          ...(structuralFieldErrors.tagIds ?? []),
          "All tagIds must be valid UUID strings.",
        ]
      }

      if (hasDuplicate) {
        semanticFieldErrors.tagIds = [
          ...(semanticFieldErrors.tagIds ?? []),
          "Must not contain duplicate tag IDs.",
        ]
      }
    }
  }

  if (Object.keys(semanticFieldErrors).length > 0) {
    throw new ApiError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Validation failed.",
      details: { fieldErrors: semanticFieldErrors },
    })
  }

  if (Object.keys(structuralFieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body is invalid.",
      details: { fieldErrors: structuralFieldErrors },
    })
  }

  const title = (body.title as string).trim()
  const content = body.content as string
  const summary =
    rawSummary === undefined ? undefined : (rawSummary as string | null)
  const catalogId =
    rawCatalogId === undefined ? undefined : (rawCatalogId as string | null)

  let tagIds: TagId[] | undefined
  if (Array.isArray(rawTagIds)) {
    const seen = new Set<string>()
    const parsed: TagId[] = []

    for (const value of rawTagIds) {
      if (typeof value !== "string") continue
      if (seen.has(value)) continue
      seen.add(value)
      parsed.push(value as TagId)
    }

    if (parsed.length > 0) {
      tagIds = parsed
    }
  }

  const command: CreatePromptCommand = {
    title,
    content,
    catalogId: catalogId ?? null,
    summary,
  }

  if (tagIds && tagIds.length > 0) {
    command.tagIds = tagIds
  }

  return command
}


