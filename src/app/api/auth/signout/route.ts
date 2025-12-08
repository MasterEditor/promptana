import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type { ErrorResponseDto } from "@/types"
import {
  getSupabaseEnvOrThrow,
  handleRouteError,
} from "@/server/api-route-helpers"
import { extractAccessToken } from "@/server/supabase-auth"

type TypedSupabaseClient = SupabaseClient<Database>

interface SignoutSuccessResponse {
  success: true
}

type SignoutErrorResponse = ErrorResponseDto

/**
 * Helper to create a response that clears auth cookies.
 */
function createSignoutResponse(): NextResponse<SignoutSuccessResponse> {
  const response = NextResponse.json<SignoutSuccessResponse>(
    { success: true },
    { status: 200 },
  )

  // Clear auth cookies by setting them to empty with expired date
  response.cookies.set("sb-access-token", "", {
    path: "/",
    expires: new Date(0),
    sameSite: "lax",
  })

  response.cookies.set("sb-refresh-token", "", {
    path: "/",
    expires: new Date(0),
    sameSite: "lax",
  })

  return response
}

/**
 * POST /api/auth/signout
 *
 * Sign out the current user by invalidating their Supabase session
 * and clearing auth cookies.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SignoutSuccessResponse | SignoutErrorResponse>> {
  try {
    const { supabaseUrl, anonKey } = getSupabaseEnvOrThrow()

    const accessToken = extractAccessToken(request)

    // If no token present, user is already signed out - clear cookies anyway
    if (!accessToken) {
      return createSignoutResponse()
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

    const { error } = await client.auth.signOut()

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/signout] signOut failed", error)
      // Even if signOut fails on Supabase side, we still want the client
      // to clear local tokens. Return success to allow client-side cleanup.
    }

    return createSignoutResponse()
  } catch (error) {
    return handleRouteError<SignoutSuccessResponse, SignoutErrorResponse>(
      error,
      "/api/auth/signout",
    )
  }
}
