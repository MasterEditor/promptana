import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CatalogDto,
  CatalogListResponseDto,
  CreateCatalogCommand,
  ErrorDetails,
  ErrorResponseDto,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import * as catalogsService from "@/server/catalogs-service"

type CatalogsListSuccessResponse = CatalogListResponseDto
type CatalogsCreateSuccessResponse = CatalogDto
type CatalogsErrorResponse = ErrorResponseDto

const MAX_SEARCH_LENGTH = 200
const CATALOG_NAME_MAX_LENGTH = 255
const CATALOG_DESCRIPTION_MAX_LENGTH = 2000

/**
 * GET /api/catalogs
 *
 * List catalogs for the authenticated user with pagination and optional
 * case-insensitive name search.
 */
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<CatalogsListSuccessResponse | CatalogsErrorResponse>
> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/catalogs",
    })

    const { page, pageSize, search } = validateListCatalogsQuery(
      request.nextUrl.searchParams,
    )

    const dto = await catalogsService.listForUser(client, userId, {
      page,
      pageSize,
      search,
    })

    return NextResponse.json<CatalogsListSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<CatalogsListSuccessResponse, CatalogsErrorResponse>(
      error,
      "/api/catalogs",
    )
  }
}

/**
 * POST /api/catalogs
 *
 * Create a new catalog for the authenticated user.
 */
export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<CatalogsCreateSuccessResponse | CatalogsErrorResponse>
> {
  try {
    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/catalogs",
    })

    const rawBody = await parseJsonBody(request)
    const command = validateCreateCatalogBody(rawBody)

    const dto = await catalogsService.createForUser(client, userId, command)

    return NextResponse.json<CatalogsCreateSuccessResponse>(dto, {
      status: 201,
    })
  } catch (error) {
    return handleRouteError<
      CatalogsCreateSuccessResponse,
      CatalogsErrorResponse
    >(error, "/api/catalogs")
  }
}

function validateListCatalogsQuery(
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

function validateCreateCatalogBody(payload: unknown): CreateCatalogCommand {
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

  const rawName = body.name
  const rawDescription = body.description

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
    } else if (trimmed.length > CATALOG_NAME_MAX_LENGTH) {
      semanticFieldErrors.name = [
        ...(semanticFieldErrors.name ?? []),
        `Must be at most ${CATALOG_NAME_MAX_LENGTH} characters long.`,
      ]
    }
  }

  // description – optional string or null
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
  const description =
    rawDescription === undefined ? undefined : (rawDescription as string | null)

  return {
    name,
    description,
  }
}


