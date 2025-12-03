import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorDetails,
  ErrorResponseDto,
  PromptId,
  PromptTagsDto,
  ReplacePromptTagsCommand,
  TagId,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as tagsService from "@/server/tags-service"
import { UUID_V4_REGEX, assertUuidPathParam } from "@/server/validation"

type PromptTagsReplaceSuccessResponse = PromptTagsDto
type PromptTagsErrorResponse = ErrorResponseDto

const MAX_TAGS_PER_PROMPT = 50

/**
 * PUT /api/prompts/{promptId}/tags
 *
 * Replace the full set of tags assigned to a prompt for the authenticated user.
 */
export async function PUT(
  request: NextRequest,
  context: { params: { promptId: string } },
): Promise<
  NextResponse<PromptTagsReplaceSuccessResponse | PromptTagsErrorResponse>
> {
  try {
    const promptId = validatePromptId(context.params.promptId)
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]/tags",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateReplacePromptTagsBody(rawBody)

    const dto = await tagsService.replacePromptTags(
      client,
      userId,
      promptId,
      command,
    )

    return NextResponse.json<PromptTagsReplaceSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      PromptTagsReplaceSuccessResponse,
      PromptTagsErrorResponse
    >(error, "/api/prompts/[promptId]/tags")
  }
}

function validatePromptId(rawPromptId: string): PromptId {
  return assertUuidPathParam("promptId", rawPromptId) as PromptId
}

function validateReplacePromptTagsBody(
  payload: unknown,
): ReplacePromptTagsCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["tagIds"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawTagIds = body.tagIds

  if (rawTagIds === undefined) {
    structuralFieldErrors.tagIds = [
      ...(structuralFieldErrors.tagIds ?? []),
      "Field is required.",
    ]
  } else if (!Array.isArray(rawTagIds)) {
    structuralFieldErrors.tagIds = [
      ...(structuralFieldErrors.tagIds ?? []),
      "Must be an array of tag IDs.",
    ]
  } else {
    if (rawTagIds.length > MAX_TAGS_PER_PROMPT) {
      semanticFieldErrors.tagIds = [
        ...(semanticFieldErrors.tagIds ?? []),
        `Must not contain more than ${MAX_TAGS_PER_PROMPT} tags.`,
      ]
    }

    const seen = new Set<string>()
    let hasDuplicate = false
    let hasInvalidElement = false

    for (const value of rawTagIds) {
      if (typeof value !== "string") {
        hasInvalidElement = true
        continue
      }

      if (!UUID_V4_REGEX.test(value)) {
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

  const tagIds = (body.tagIds as string[]).map((id) => id as TagId)

  return {
    tagIds,
  }
}


