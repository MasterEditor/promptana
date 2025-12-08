import type { NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import { getSupabaseEnvOrThrow } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import type { UserId } from "@/types"

export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Extract the Supabase access token from Authorization header or cookie.
 *
 * This helper is shared across API routes to ensure consistent auth behavior.
 */
export function extractAccessToken(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization")

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim()
  }

  const cookieToken = request.cookies.get("sb-access-token")?.value
  return cookieToken ?? null
}

/**
 * Instantiate a typed Supabase client bound to the incoming user's access token
 * and return the authenticated user's id.
 *
 * Throws ApiError with:
 * - 401 UNAUTHORIZED when the token is missing/invalid
 * - 500 INTERNAL_ERROR when Supabase env or auth validation fails
 */
export async function getSupabaseClientAndUserId(
  request: NextRequest,
  options?: { routeId?: string },
): Promise<{ client: TypedSupabaseClient; userId: UserId }> {
  const { supabaseUrl, anonKey } = getSupabaseEnvOrThrow()

  const accessToken = extractAccessToken(request)

  if (!accessToken) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    })
  }

  const client: TypedSupabaseClient = createClient<Database>(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  )

  const { data, error: authError } = await client.auth.getUser(accessToken)

  if (authError) {
    // eslint-disable-next-line no-console
    console.error(
      `[${options?.routeId ?? "supabase-auth"}] getUser failed`,
      authError,
    )

    // Treat most auth errors as 401 UNAUTHORIZED to allow token refresh.
    // This includes: expired tokens, invalid tokens, malformed JWTs, etc.
    // Only treat actual server/network errors as 500.
    const isAuthError =
      authError.status === 401 ||
      authError.status === 403 ||
      authError.message?.toLowerCase().includes("jwt") ||
      authError.message?.toLowerCase().includes("token") ||
      authError.message?.toLowerCase().includes("expired") ||
      authError.message?.toLowerCase().includes("invalid")

    if (isAuthError) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Session expired. Please sign in again.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to validate Supabase session.",
    })
  }

  const user = data.user

  if (!user || !user.id) {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Supabase user payload is missing an id.",
    })
  }

  return {
    client,
    userId: user.id as UserId,
  }
}


