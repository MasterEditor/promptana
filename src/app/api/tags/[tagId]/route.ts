import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {ErrorDetails, ErrorResponseDto, TagDto, TagId, UpdateTagCommand} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as tagsService from "@/server/tags-service"
import { assertUuidPathParam } from "@/server/validation"

type TagsUpdateSuccessResponse = TagDto
type TagsDeleteSuccessResponse = null
type TagsByIdErrorResponse = ErrorResponseDto

const TAG_NAME_MAX_LENGTH = 255

/**
 * PATCH /api/tags/{tagId}
 *
 * Rename a tag for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: { tagId: string } },
): Promise<NextResponse<TagsUpdateSuccessResponse | TagsByIdErrorResponse>> {
  try {
    const tagId = validateTagId(context.params.tagId)
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/tags/[tagId]",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateUpdateTagBody(rawBody)

    const dto = await tagsService.updateForUser(client, userId, tagId, command)

    return NextResponse.json<TagsUpdateSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<TagsUpdateSuccessResponse, TagsByIdErrorResponse>(
      error,
      "/api/tags/[tagId]",
    )
  }
}

/**
 * DELETE /api/tags/{tagId}
 *
 * Delete a tag belonging to the authenticated user. Associations in the
 * prompt_tags table are cleaned up via ON DELETE CASCADE.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { tagId: string } },
): Promise<NextResponse<TagsDeleteSuccessResponse | TagsByIdErrorResponse>> {
  try {
    const tagId = validateTagId(context.params.tagId)
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/tags/[tagId]",
    })

    await tagsService.deleteForUser(client, userId, tagId)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError<TagsDeleteSuccessResponse, TagsByIdErrorResponse>(
      error,
      "/api/tags/[tagId]",
    )
  }
}

function validateTagId(rawTagId: string): TagId {
  return assertUuidPathParam("tagId", rawTagId)
}

function validateUpdateTagBody(payload: unknown): UpdateTagCommand {
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

  const hasName = Object.prototype.hasOwnProperty.call(body, "name")
  const rawName = body.name

  if (!hasName) {
    structuralFieldErrors._ = [
      ...(structuralFieldErrors._ ?? []),
      "Field 'name' must be provided.",
    ]
  }

  if (hasName) {
    if (rawName === undefined) {
      structuralFieldErrors.name = [
        ...(structuralFieldErrors.name ?? []),
        "Field is required when provided.",
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

  const command: UpdateTagCommand = {}

  if (hasName && typeof rawName === "string") {
    command.name = rawName.trim()
  }

  return command
}


