import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type { CurrentUserDto, UserId } from "@/types"
import { ApiError } from "@/server/http-errors"

type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Compose the authenticated user's profile.
 *
 * This helper is used by GET /api/me to keep the route handler thin.
 */
export async function getCurrentUser(
  client: TypedSupabaseClient,
  userId: UserId,
): Promise<CurrentUserDto> {
  const { data, error } = await client.auth.getUser()

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[current-user-service] getUser failed", error)

    // Map auth-related failures to UNAUTHORIZED when possible; otherwise treat
    // as an internal error.
    if (error.status === 401) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Invalid or expired Supabase session.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load user profile.",
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

  const dto: CurrentUserDto = {
    id: user.id as UserId,
    email: user.email ?? "",
    createdAt: user.created_at,
  }

  return dto
}



