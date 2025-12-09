import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { ApiError, apiErrorToResponse } from "@/server/http-errors"
import type { ErrorResponseDto } from "@/types"

/**
 * Safely parse a JSON request body and normalize JSON parse errors to ApiError.
 */
export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      })
    }

    throw error
  }
}

/**
 * Standardized catch-all error handler for API route handlers.
 *
 * Converts known ApiError instances into an ErrorResponseDto, and falls back
 * to a generic INTERNAL_ERROR + 500 status for unexpected errors.
 */
export function handleRouteError<TSuccess, TError extends ErrorResponseDto>(
  error: unknown,
  routeId: string,
): NextResponse<TSuccess | TError> {
  if (error instanceof ApiError) {
    const { status, body } = apiErrorToResponse(error)
    return NextResponse.json<TError>(body as TError, { status })
  }

  // eslint-disable-next-line no-console
  console.error(`[${routeId}] Unhandled error`, error)

  const body: ErrorResponseDto = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  }

  return NextResponse.json<TError>(body as TError, { status: 500 })
}

/**
 * Helper to read required Supabase environment variables or throw a 500 ApiError.
 */
export function getSupabaseEnvOrThrow(): {
  supabaseUrl: string
  anonKey: string
} {
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !anonKey) {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Supabase environment variables are not configured.",
    })
  }

  return { supabaseUrl, anonKey }
}


