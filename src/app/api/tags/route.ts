import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CreateTagCommand,
  ErrorDetails,
  ErrorResponseDto,
  TagDto,
  TagListResponseDto,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as tagsService from "@/server/tags-service"

type TagsListSuccessResponse = TagListResponseDto
type TagsCreateSuccessResponse = TagDto
type TagsErrorResponse = ErrorResponseDto

const MAX_SEARCH_LENGTH = 200
const TAG_NAME_MAX_LENGTH = 255

/**
 * GET /api/tags
 *
 * List tags for the authenticated user with pagination and optional
 * case-insensitive name search.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<TagsListSuccessResponse | TagsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/tags",
    })

    const { page, pageSize, search } = validateListTagsQuery(
      request.nextUrl.searchParams,
    )

    const dto = await tagsService.listForUser(client, userId, {
      page,
      pageSize,
      search,
    })

    return NextResponse.json<TagsListSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<TagsListSuccessResponse, TagsErrorResponse>(
      error,
      "/api/tags",
    )
  }
}

/**
 * POST /api/tags
 *
 * Create a new tag for the authenticated user.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<TagsCreateSuccessResponse | TagsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/tags",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateCreateTagBody(rawBody)

    const dto = await tagsService.createForUser(client, userId, command)

    return NextResponse.json<TagsCreateSuccessResponse>(dto, { status: 201 })
  } catch (error) {
    return handleRouteError<TagsCreateSuccessResponse, TagsErrorResponse>(
      error,
      "/api/tags",
    )
  }
}

function validateListTagsQuery(
  searchParams: URLSearchParams,
): { page: number; pageSize: number; search?: string } {
  const rawPage = searchParams.get("page")
  const rawPageSize = searchParams.get("pageSize")
  const rawSearch = searchParams.get("search")

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
  let pageSize = 50
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize)
    if (!Number.isInteger(parsed)) {
      fieldErrors.pageSize = ["Must be an integer."]
    } else if (parsed < 1 || parsed > 200) {
      fieldErrors.pageSize = ["Must be between 1 and 200."]
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

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Query parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return { page, pageSize, search }
}

function validateCreateTagBody(payload: unknown): CreateTagCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["name"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawName = body.name

  // name – required, string
  if (rawName === undefined) {
    structuralFieldErrors.name = [
      ...(structuralFieldErrors.name ?? []),
      "Field is required.",
    ]
  } else if (typeof rawName !== "string") {
    structuralFieldErrors.name = [
      ...(structuralFieldErrors.name ?? []),
      "Must be a string.",
    ]
  } else {
    const trimmed = rawName.trim()

    if (trimmed.length === 0) {
      semanticFieldErrors.name = [
        ...(semanticFieldErrors.name ?? []),
        "Must not be empty.",
      ]
    } else if (trimmed.length > TAG_NAME_MAX_LENGTH) {
      semanticFieldErrors.name = [
        ...(semanticFieldErrors.name ?? []),
        `Must be at most ${TAG_NAME_MAX_LENGTH} characters long.`,
      ]
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

  const name = (body.name as string).trim()

  return {
    name,
  }
}


