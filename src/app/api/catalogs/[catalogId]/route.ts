import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CatalogDto,
  ErrorDetails,
  ErrorResponseDto,
  UpdateCatalogCommand,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as catalogsService from "@/server/catalogs-service"

type CatalogsGetByIdSuccessResponse = CatalogDto
type CatalogsUpdateSuccessResponse = CatalogDto
type CatalogsDeleteSuccessResponse = null
type CatalogsByIdErrorResponse = ErrorResponseDto

const CATALOG_NAME_MAX_LENGTH = 255
const CATALOG_DESCRIPTION_MAX_LENGTH = 2000

/**
 * PATCH /api/catalogs/{catalogId}
 *
 * Update a catalog's mutable fields (name, description) for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: { catalogId: string } },
): Promise<
  NextResponse<
    CatalogsUpdateSuccessResponse | CatalogsByIdErrorResponse
  >
> {
  try {
    const catalogId = validateCatalogId(context.params.catalogId)
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/catalogs/[catalogId]",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateUpdateCatalogBody(rawBody)

    const dto = await catalogsService.updateForUser(
      client,
      userId,
      catalogId,
      command,
    )

    return NextResponse.json<CatalogsUpdateSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      CatalogsUpdateSuccessResponse,
      CatalogsByIdErrorResponse
    >(error, "/api/catalogs/[catalogId]")
  }
}

/**
 * DELETE /api/catalogs/{catalogId}
 *
 * Delete a catalog belonging to the authenticated user. Prompts referencing
 * the catalog are unassigned (their catalog_id set to null).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { catalogId: string } },
): Promise<
  NextResponse<
    CatalogsDeleteSuccessResponse | CatalogsByIdErrorResponse
  >
> {
  try {
    const catalogId = validateCatalogId(context.params.catalogId)
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/catalogs/[catalogId]",
    })

    await catalogsService.deleteForUser(client, userId, catalogId)

    // 204 NO_CONTENT – ensure the body is empty.
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError<
      CatalogsDeleteSuccessResponse,
      CatalogsByIdErrorResponse
    >(error, "/api/catalogs/[catalogId]")
  }
}

function validateCatalogId(rawCatalogId: string): string {
  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  // Basic UUID v4-style shape check. We intentionally do not over-validate, but
  // we ensure clearly malformed IDs receive a 400 instead of a 404.
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

  if (!uuidRegex.test(rawCatalogId)) {
    fieldErrors.catalogId = ["Must be a valid UUID string."]
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Path parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return rawCatalogId
}

function validateUpdateCatalogBody(payload: unknown): UpdateCatalogCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["name", "description"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, "name")
  const hasDescription = Object.prototype.hasOwnProperty.call(
    body,
    "description",
  )

  if (!hasName && !hasDescription) {
    structuralFieldErrors._ = [
      ...(structuralFieldErrors._ ?? []),
      "At least one of 'name' or 'description' must be provided.",
    ]
  }

  const rawName = body.name
  const rawDescription = body.description

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
      } else if (trimmed.length > CATALOG_NAME_MAX_LENGTH) {
        semanticFieldErrors.name = [
          ...(semanticFieldErrors.name ?? []),
          `Must be at most ${CATALOG_NAME_MAX_LENGTH} characters long.`,
        ]
      }
    }
  }

  if (hasDescription) {
    if (rawDescription !== undefined && rawDescription !== null) {
      if (typeof rawDescription !== "string") {
        structuralFieldErrors.description = [
          ...(structuralFieldErrors.description ?? []),
          "Must be a string or null.",
        ]
      } else if (rawDescription.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
        semanticFieldErrors.description = [
          ...(semanticFieldErrors.description ?? []),
          `Must be at most ${CATALOG_DESCRIPTION_MAX_LENGTH} characters long.`,
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

  const command: UpdateCatalogCommand = {}

  if (hasName && typeof rawName === "string") {
    command.name = rawName.trim()
  }

  if (hasDescription) {
    command.description =
      rawDescription === undefined
        ? undefined
        : (rawDescription as string | null)
  }

  return command
}


