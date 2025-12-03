import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorDetails,
  ErrorResponseDto,
  RetentionPolicy,
  UpdateUserSettingsCommand,
  UserSettingsDto,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import {
  getSupabaseClientAndUserId,
  type TypedSupabaseClient,
} from "@/server/supabase-auth"
import * as userSettingsService from "@/server/user-settings-service"

const ALLOWED_RETENTION_POLICIES: RetentionPolicy[] = [
  "fourteen_days",
  "thirty_days",
  "always",
]

type SettingsSuccessResponse = UserSettingsDto
type SettingsErrorResponse = ErrorResponseDto

/**
 * GET /api/settings
 *
 * Returns the authenticated user's settings, creating a default row when one
 * does not yet exist.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<SettingsSuccessResponse | SettingsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/settings",
    })
    const dto = await userSettingsService.getOrCreateForUser(client, userId)
    return NextResponse.json<SettingsSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<SettingsSuccessResponse, SettingsErrorResponse>(
      error,
      "/api/settings",
    )
  }
}

/**
 * PUT /api/settings
 *
 * Updates the authenticated user's retention policy.
 */
export async function PUT(
  request: NextRequest,
): Promise<NextResponse<SettingsSuccessResponse | SettingsErrorResponse>> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/settings",
    })
    const rawBody = await parseJsonBody(request)
    const command = validateUpdateUserSettingsBody(rawBody)
    const dto = await userSettingsService.updateForUser(client, userId, command)
    return NextResponse.json<SettingsSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<SettingsSuccessResponse, SettingsErrorResponse>(
      error,
      "/api/settings",
    )
  }
}

function validateUpdateUserSettingsBody(
  payload: unknown,
): UpdateUserSettingsCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["retentionPolicy"])

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      fieldErrors[key] = ["Unknown field."]
    }
  }

  const rawRetentionPolicy = body.retentionPolicy

  if (rawRetentionPolicy === undefined) {
    fieldErrors.retentionPolicy = [
      ...(fieldErrors.retentionPolicy ?? []),
      "Field is required.",
    ]
  } else if (typeof rawRetentionPolicy !== "string") {
    fieldErrors.retentionPolicy = [
      ...(fieldErrors.retentionPolicy ?? []),
      "Must be a string.",
    ]
  } else if (
    !ALLOWED_RETENTION_POLICIES.includes(
      rawRetentionPolicy as RetentionPolicy,
    )
  ) {
    // Semantic validation – invalid enum value
    throw new ApiError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Validation failed.",
      details: {
        fieldErrors: {
          retentionPolicy: [
            "Must be one of ['fourteen_days','thirty_days','always'].",
          ],
        },
      },
    })
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body is invalid.",
      details: {
        fieldErrors,
      },
    })
  }

  const retentionPolicy = rawRetentionPolicy as RetentionPolicy

  return { retentionPolicy }
}