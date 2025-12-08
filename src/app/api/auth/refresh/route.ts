import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type { ErrorResponseDto } from "@/types"
import { getSupabaseEnvOrThrow, handleRouteError } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"

type TypedSupabaseClient = SupabaseClient<Database>

interface RefreshSuccessResponse {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

type RefreshErrorResponse = ErrorResponseDto

/**
 * POST /api/auth/refresh
 *
 * Refresh an expired access token using the refresh token stored in cookies.
 * Returns new tokens that should be stored by the client.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<RefreshSuccessResponse | RefreshErrorResponse>> {
  try {
    const refreshToken = request.cookies.get("sb-refresh-token")?.value

    if (!refreshToken) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "No refresh token available. Please sign in again.",
      })
    }

    const { client } = createSupabaseClient()

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/refresh] refreshSession failed", error)

      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Unable to refresh session. Please sign in again.",
      })
    }

    const { session } = data

    // Create response with new tokens
    const response = NextResponse.json<RefreshSuccessResponse>(
      {
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? null,
        expiresAt: session.expires_at ?? 0,
      },
      { status: 200 },
    )

    // Also set the cookies directly for convenience
    response.cookies.set("sb-access-token", session.access_token, {
      path: "/",
      sameSite: "lax",
      // Set expiry based on token expiration (typically 1 hour for access tokens)
      maxAge: session.expires_in ?? 3600,
    })

    if (session.refresh_token) {
      response.cookies.set("sb-refresh-token", session.refresh_token, {
        path: "/",
        sameSite: "lax",
        // Refresh tokens typically last longer (e.g., 7 days)
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    return response
  } catch (error) {
    return handleRouteError<RefreshSuccessResponse, RefreshErrorResponse>(
      error,
      "/api/auth/refresh",
    )
  }
}

function createSupabaseClient(): { client: TypedSupabaseClient } {
  const { supabaseUrl, anonKey } = getSupabaseEnvOrThrow()

  const client: TypedSupabaseClient = createClient<Database>(
    supabaseUrl,
    anonKey,
  )

  return { client }
}

