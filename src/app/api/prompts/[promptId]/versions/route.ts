import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorDetails,
  ErrorResponseDto,
  PromptId,
  PromptVersionListResponseDto,
} from "@/types"
import {
  handleRouteError,
  parseJsonBody,
} from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import * as promptVersionsService from "@/server/prompt-versions-service"

type PromptVersionsListSuccessResponse = PromptVersionListResponseDto
type PromptVersionsCreateSuccessResponse =
  promptVersionsService.CreatePromptVersionResponseDtoAlias
type PromptVersionsErrorResponse = ErrorResponseDto

const PROMPT_TITLE_MAX_LENGTH = 255
const PROMPT_CONTENT_MAX_LENGTH = 100_000
const PROMPT_SUMMARY_MAX_LENGTH = 1_000

interface ListQueryParams {
  page: number
  pageSize: number
}

/**
 * GET /api/prompts/{promptId}/versions
 *
 * List versions for the authenticated user's prompt with pagination.
 */
export async function GET(
  request: NextRequest,
  context: { params: { promptId: string } },
): Promise<
  NextResponse<
    PromptVersionsListSuccessResponse | PromptVersionsErrorResponse
  >
> {
  try {
    const promptId = validatePromptId(context.params.promptId)
    const { page, pageSize } = validateListQuery(
      request.nextUrl.searchParams,
    )

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]/versions",
    })

    const dto = await promptVersionsService.listForPromptForUser(
      client,
      userId,
      promptId,
      {
        page,
        pageSize,
      },
    )

    return NextResponse.json<PromptVersionsListSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      PromptVersionsListSuccessResponse,
      PromptVersionsErrorResponse
    >(error, "/api/prompts/[promptId]/versions")
  }
}

/**
 * POST /api/prompts/{promptId}/versions
 *
 * Create a new version of the prompt's content for the authenticated user and
 * update the prompt's current_version_id. This endpoint supports both manual
 * saves and accepted "Improve" suggestions.
 */
export async function POST(
  request: NextRequest,
  context: { params: { promptId: string } },
): Promise<
  NextResponse<
    PromptVersionsCreateSuccessResponse | PromptVersionsErrorResponse
  >
> {
  try {
    const promptId = validatePromptId(context.params.promptId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]/versions",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateCreatePromptVersionBody(rawBody)

    const dto = await promptVersionsService.createForUser(
      client,
      userId,
      promptId,
      command,
    )

    return NextResponse.json<PromptVersionsCreateSuccessResponse>(dto, {
      status: 201,
    })
  } catch (error) {
    return handleRouteError<
      PromptVersionsCreateSuccessResponse,
      PromptVersionsErrorResponse
    >(error, "/api/prompts/[promptId]/versions")
  }
}

function validatePromptId(rawPromptId: string): PromptId {
  return assertUuidPathParam("promptId", rawPromptId) as PromptId
}

function validateListQuery(searchParams: URLSearchParams): ListQueryParams {
  const rawPage = searchParams.get("page")
  const rawPageSize = searchParams.get("pageSize")

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

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

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Query parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return { page, pageSize }
}

/**
 * Validate the body for creating a new prompt version. This mirrors the
 * structural/semantic split used by other resources:
 * - 400 BAD_REQUEST for structural issues / unknown fields.
 * - 422 VALIDATION_FAILED for semantic/length/value violations.
 */
function validateCreatePromptVersionBody(
  payload: unknown,
): promptVersionsService.CreatePromptVersionCommandAlias {
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
    "summary",
    "source",
    "baseVersionId",
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
  const rawSummary = body.summary
  const rawSource = body.source
  const rawBaseVersionId = body.baseVersionId

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

  // source – required, "manual" | "improve"
  if (rawSource === undefined) {
    structuralFieldErrors.source = [
      ...(structuralFieldErrors.source ?? []),
      "Field is required.",
    ]
  } else if (typeof rawSource !== "string") {
    structuralFieldErrors.source = [
      ...(structuralFieldErrors.source ?? []),
      "Must be a string.",
    ]
  } else if (rawSource !== "manual" && rawSource !== "improve") {
    semanticFieldErrors.source = [
      ...(semanticFieldErrors.source ?? []),
      'Must be either "manual" or "improve".',
    ]
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

  // baseVersionId – optional UUID or null
  if (rawBaseVersionId !== undefined && rawBaseVersionId !== null) {
    if (typeof rawBaseVersionId !== "string") {
      structuralFieldErrors.baseVersionId = [
        ...(structuralFieldErrors.baseVersionId ?? []),
        "Must be a string or null.",
      ]
    } else {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

      if (!uuidRegex.test(rawBaseVersionId)) {
        structuralFieldErrors.baseVersionId = [
          ...(structuralFieldErrors.baseVersionId ?? []),
          "Must be a valid UUID string.",
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
  const source = rawSource as "manual" | "improve"
  const baseVersionId =
    rawBaseVersionId === undefined
      ? undefined
      : (rawBaseVersionId as string | null)

  const command: promptVersionsService.CreatePromptVersionCommandAlias = {
    title,
    content,
    summary,
    source,
    baseVersionId,
  }

  return command
}


