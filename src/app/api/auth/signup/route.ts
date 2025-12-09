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

interface SignupRequestBody {
  email: string
  password: string
}

interface SignupSuccessResponse {
  accessToken: string
  refreshToken: string | null
  user: {
    id: string
    email: string
    createdAt: string
  }
}

type SignupErrorResponse = ErrorResponseDto

/**
 * POST /api/auth/signup
 *
 * Register a new user with email/password using Supabase.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SignupSuccessResponse | SignupErrorResponse>> {
  try {
    const rawBody = await parseJsonBody(request)
    const { email, password } = validateSignupBody(rawBody)

    const { client } = createSupabaseClient()
    const { data, error } = await client.auth.signUp({
      email,
      password,
    })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/signup] signUp failed", error)

      // Handle specific Supabase auth errors
      if (error.message?.toLowerCase().includes("already registered")) {
        throw new ApiError({
          status: 409,
          code: "CONFLICT",
          message: "A user with this email already exists.",
        })
      }

      if (error.message?.toLowerCase().includes("password")) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: error.message,
        })
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: error.message || "Registration failed. Please try again.",
      })
    }

    if (!data.session || !data.user) {
      // This can happen when:
      // 1. Email confirmation is required - user needs to confirm email before signing in
      // 2. Email already exists - Supabase returns fake success to prevent email enumeration
      //
      // To detect case 2: if we have a user but no session, and the user's identities array
      // is empty, it means this is a fake user object returned for an existing email.
      if (data.user && !data.session) {
        // Check if this is a fake user (duplicate email detection)
        // When email already exists, Supabase returns a user object with empty identities
        const identities = data.user.identities ?? []
        if (identities.length === 0) {
          throw new ApiError({
            status: 409,
            code: "CONFLICT",
            message: "A user with this email already exists.",
          })
        }

        // Otherwise, email confirmation is genuinely required
        return NextResponse.json<SignupSuccessResponse>(
          {
            accessToken: "",
            refreshToken: null,
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              createdAt: data.user.created_at,
            },
          },
          { status: 201 },
        )
      }

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Registration succeeded but session was not created.",
      })
    }

    const { session, user } = data

    return NextResponse.json<SignupSuccessResponse>(
      {
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? null,
        user: {
          id: user.id,
          email: user.email ?? "",
          createdAt: user.created_at,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError<SignupSuccessResponse, SignupErrorResponse>(
      error,
      "/api/auth/signup",
    )
  }
}

function validateSignupBody(payload: unknown): SignupRequestBody {
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

  const fieldErrors: NonNullable<SignupErrorResponse["error"]["details"]>["fieldErrors"] =
    {}

  if (email === undefined) {
    fieldErrors.email = ["Field is required."]
  } else if (typeof email !== "string") {
    fieldErrors.email = ["Must be a string."]
  } else if (!email.trim()) {
    fieldErrors.email = ["Email is required."]
  } else {
    const basicEmailPattern = /\S+@\S+\.\S+/
    if (!basicEmailPattern.test(email)) {
      fieldErrors.email = ["Please enter a valid email address."]
    }
  }

  if (password === undefined) {
    fieldErrors.password = ["Field is required."]
  } else if (typeof password !== "string") {
    fieldErrors.password = ["Must be a string."]
  } else if (password.length < 6) {
    fieldErrors.password = ["Password must be at least 6 characters."]
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
