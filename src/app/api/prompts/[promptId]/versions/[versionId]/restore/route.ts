import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorDetails,
  ErrorResponseDto,
  PromptId,
  PromptVersionId,
  RestorePromptVersionCommand,
  RestorePromptVersionResponseDto,
} from "@/types"
import {
  handleRouteError,
  parseJsonBody,
} from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import * as promptVersionsService from "@/server/prompt-versions-service"

type PromptVersionRestoreSuccessResponse = RestorePromptVersionResponseDto
type PromptVersionRestoreErrorResponse = ErrorResponseDto

const PROMPT_SUMMARY_MAX_LENGTH = 1_000

/**
 * POST /api/prompts/{promptId}/versions/{versionId}/restore
 *
 * Restore a previous version as the current one by creating a new version that
 * copies the source version's title and content, optionally with a custom
 * summary. The parent prompt's current_version_id is updated, and a
 * run_events "restore" entry is logged.
 */
export async function POST(
  request: NextRequest,
  context: { params: { promptId: string; versionId: string } },
): Promise<
  NextResponse<
    PromptVersionRestoreSuccessResponse | PromptVersionRestoreErrorResponse
  >
> {
  try {
    const promptId = validatePromptId(context.params.promptId)
    const versionId = validateVersionId(context.params.versionId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]/versions/[versionId]/restore",
    })

    const rawBody = await parseOptionalRestoreBody(request)
    const command = validateRestorePromptVersionBody(rawBody)

    const dto = await promptVersionsService.restoreForUser(
      client,
      userId,
      promptId,
      versionId,
      command,
    )

    return NextResponse.json<PromptVersionRestoreSuccessResponse>(dto, {
      status: 201,
    })
  } catch (error) {
    return handleRouteError<
      PromptVersionRestoreSuccessResponse,
      PromptVersionRestoreErrorResponse
    >(error, "/api/prompts/[promptId]/versions/[versionId]/restore")
  }
}

function validatePromptId(rawPromptId: string): PromptId {
  return assertUuidPathParam("promptId", rawPromptId) as PromptId
}

function validateVersionId(rawVersionId: string): PromptVersionId {
  return assertUuidPathParam("versionId", rawVersionId) as PromptVersionId
}

async function parseOptionalRestoreBody(
  request: NextRequest,
): Promise<unknown> {
  try {
    return await parseJsonBody(request)
  } catch (error) {
    // Treat completely missing/invalid JSON bodies as "no payload" for this
    // endpoint, allowing clients to omit the summary field entirely.
    if (error instanceof ApiError && error.code === "BAD_REQUEST") {
      return undefined
    }
    throw error
  }
}

function validateRestorePromptVersionBody(
  payload: unknown,
): RestorePromptVersionCommand {
  if (payload === undefined || payload === null) {
    return {}
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object when provided.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["summary"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawSummary = body.summary

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

  const summary =
    rawSummary === undefined ? undefined : (rawSummary as string | null)

  const command: RestorePromptVersionCommand = {}

  if (summary !== undefined) {
    command.summary = summary
  }

  return command
}


