import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  DeletePromptCommand,
  ErrorDetails,
  ErrorResponseDto,
  PromptDetailDto,
  PromptId,
  UpdatePromptMetadataCommand,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as promptsService from "@/server/prompts-service"

type PromptDetailSuccessResponse = PromptDetailDto
type PromptDetailErrorResponse = ErrorResponseDto

/**
 * GET /api/prompts/{promptId}
 *
 * Return full prompt metadata, current content, last run summary, and optional
 * versions and runs for the authenticated user.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> },
): Promise<
  NextResponse<PromptDetailSuccessResponse | PromptDetailErrorResponse>
> {
  try {
    const { promptId: rawPromptId } = await context.params
    const promptId = validatePromptId(rawPromptId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]",
    })

    const { includeVersions, includeRuns } = validateDetailQuery(
      request.nextUrl.searchParams,
    )

    const dto = await promptsService.getDetailForUser(client, userId, promptId, {
      includeVersions,
      includeRuns,
    })

    return NextResponse.json<PromptDetailSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      PromptDetailSuccessResponse,
      PromptDetailErrorResponse
    >(error, "/api/prompts/[promptId]")
  }
}

/**
 * PATCH /api/prompts/{promptId}
 *
 * Update prompt metadata (title, catalog, tags) without creating a new content
 * version.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> },
): Promise<
  NextResponse<PromptDetailSuccessResponse | PromptDetailErrorResponse>
> {
  try {
    const { promptId: rawPromptId } = await context.params
    const promptId = validatePromptId(rawPromptId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateUpdatePromptMetadataBody(rawBody)

    const dto = await promptsService.updateMetadataForUser(
      client,
      userId,
      promptId,
      command,
    )

    return NextResponse.json<PromptDetailSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      PromptDetailSuccessResponse,
      PromptDetailErrorResponse
    >(error, "/api/prompts/[promptId]")
  }
}

/**
 * DELETE /api/prompts/{promptId}
 *
 * Permanently delete a prompt and its dependent data for the authenticated
 * user. The client is expected to obtain confirmation before calling this
 * endpoint; an optional confirm flag is accepted for an additional guard.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> },
): Promise<NextResponse<PromptDetailErrorResponse>> {
  try {
    const { promptId: rawPromptId } = await context.params
    const promptId = validatePromptId(rawPromptId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]",
    })

    const rawBody = await parseOptionalDeleteBody(request)

    if (rawBody && rawBody.confirm !== undefined && rawBody.confirm !== true) {
      const fieldErrors: ErrorDetails["fieldErrors"] = {
        confirm: ["Must be true when provided."],
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Request body is invalid.",
        details: { fieldErrors },
      })
    }

    await promptsService.deleteForUser(client, userId, promptId, rawBody ?? undefined)

    return NextResponse.json<PromptDetailErrorResponse | undefined>(undefined, {
      status: 204,
    })
  } catch (error) {
    return handleRouteError<never, PromptDetailErrorResponse>(
      error,
      "/api/prompts/[promptId]",
    )
  }
}

function validatePromptId(rawPromptId: string): PromptId {
  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

  if (!uuidRegex.test(rawPromptId)) {
    fieldErrors.promptId = ["Must be a valid UUID string."]
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Path parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return rawPromptId as PromptId
}

function validateDetailQuery(searchParams: URLSearchParams): {
  includeVersions: boolean
  includeRuns: boolean
} {
  const rawIncludeVersions = searchParams.get("includeVersions")
  const rawIncludeRuns = searchParams.get("includeRuns")

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  let includeVersions = false
  if (rawIncludeVersions !== null) {
    if (rawIncludeVersions === "true" || rawIncludeVersions === "1") {
      includeVersions = true
    } else if (rawIncludeVersions === "false" || rawIncludeVersions === "0") {
      includeVersions = false
    } else {
      fieldErrors.includeVersions = ["Must be a boolean-like value."]
    }
  }

  let includeRuns = false
  if (rawIncludeRuns !== null) {
    if (rawIncludeRuns === "true" || rawIncludeRuns === "1") {
      includeRuns = true
    } else if (rawIncludeRuns === "false" || rawIncludeRuns === "0") {
      includeRuns = false
    } else {
      fieldErrors.includeRuns = ["Must be a boolean-like value."]
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

  return { includeVersions, includeRuns }
}

function validateUpdatePromptMetadataBody(
  payload: unknown,
): UpdatePromptMetadataCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["title", "catalogId", "tagIds"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawTitle = body.title
  const rawCatalogId = body.catalogId
  const rawTagIds = body.tagIds

  if (
    rawTitle === undefined &&
    rawCatalogId === undefined &&
    rawTagIds === undefined
  ) {
    structuralFieldErrors._ = [
      "At least one of title, catalogId, or tagIds must be provided.",
    ]
  }

  if (rawTitle !== undefined) {
    if (typeof rawTitle !== "string") {
      structuralFieldErrors.title = [
        ...(structuralFieldErrors.title ?? []),
        "Must be a string.",
      ]
    } else if (rawTitle.trim().length === 0) {
      semanticFieldErrors.title = [
        ...(semanticFieldErrors.title ?? []),
        "Must not be empty when provided.",
      ]
    }
  }

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

  if (rawTagIds !== undefined) {
    if (!Array.isArray(rawTagIds)) {
      structuralFieldErrors.tagIds = [
        ...(structuralFieldErrors.tagIds ?? []),
        "Must be an array of tag IDs.",
      ]
    } else {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

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

  const command: UpdatePromptMetadataCommand = {}

  if (rawTitle !== undefined) {
    command.title = (rawTitle as string).trim()
  }

  if (rawCatalogId !== undefined) {
    command.catalogId = rawCatalogId as string | null
  }

  if (Array.isArray(rawTagIds)) {
    const seen = new Set<string>()
    const parsed: string[] = []

    for (const value of rawTagIds) {
      if (typeof value !== "string") continue
      if (seen.has(value)) continue
      seen.add(value)
      parsed.push(value)
    }

    command.tagIds = parsed
  }

  return command
}

async function parseOptionalDeleteBody(
  request: NextRequest,
): Promise<DeletePromptCommand | null> {
  try {
    const raw = await request.json()

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null
    }

    const body = raw as Record<string, unknown>
    const command: DeletePromptCommand = {
      confirm: Boolean(body.confirm),
    }

    return command
  } catch {
    // No body or invalid JSON – treat as no confirmation payload.
    return null
  }
}

