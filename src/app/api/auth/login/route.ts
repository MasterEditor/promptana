import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type { ErrorResponseDto } from "@/types"
import {
  getSupabaseEnvOrThrow,
  handleRouteError,
  parseJsonBody,
} from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"

type TypedSupabaseClient = SupabaseClient<Database>

interface LoginRequestBody {
  email: string
  password: string
}

interface LoginSuccessResponse {
  accessToken: string
  refreshToken: string | null
  user: {
    id: string
    email: string
    createdAt: string
  }
}

type LoginErrorResponse = ErrorResponseDto

/**
 * POST /api/auth/login
 *
 * Simple email/password login using Supabase.
 * Intended for local tests and non-production usage.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<LoginSuccessResponse | LoginErrorResponse>> {
  try {
    const rawBody = await parseJsonBody(request)
    const { email, password } = validateLoginBody(rawBody)

    const { client } = createSupabaseClient()
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session || !data.user) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/login] signInWithPassword failed", error)

      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      })
    }

    const { session, user } = data

    return NextResponse.json<LoginSuccessResponse>(
      {
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? null,
        user: {
          id: user.id,
          email: user.email ?? "",
          createdAt: user.created_at,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    return handleRouteError<LoginSuccessResponse, LoginErrorResponse>(
      error,
      "/api/auth/login",
    )
  }
}

function validateLoginBody(payload: unknown): LoginRequestBody {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>

  const email = body.email
  const password = body.password

  const fieldErrors: NonNullable<LoginErrorResponse["error"]["details"]>["fieldErrors"] =
    {}

  if (email === undefined) {
    fieldErrors.email = ["Field is required."]
  } else if (typeof email !== "string") {
    fieldErrors.email = ["Must be a string."]
  }

  if (password === undefined) {
    fieldErrors.password = ["Field is required."]
  } else if (typeof password !== "string") {
    fieldErrors.password = ["Must be a string."]
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

  return {
    email: email as string,
    password: password as string,
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