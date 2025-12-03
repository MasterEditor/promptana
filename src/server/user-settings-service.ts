import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  UserId,
  UserSettingsEntity,
  UserSettingsDto,
  UpdateUserSettingsCommand,
} from "@/types"
import { ApiError } from "@/server/http-errors"

type UserSettingsRow = UserSettingsEntity

function mapRowToDto(row: UserSettingsRow): UserSettingsDto {
  return {
    userId: row.user_id,
    retentionPolicy: row.retention_policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Load existing user_settings row or create one with default retention policy.
 */
export async function getOrCreateForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
): Promise<UserSettingsDto> {
  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[user-settings-service] select user_settings failed", error)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load user settings.",
    })
  }

  if (data) {
    return mapRowToDto(data as UserSettingsRow)
  }

  // No existing row – insert one relying on DB defaults for retention_policy and timestamps.
  const { data: inserted, error: insertError } = await client
    .from("user_settings")
    .insert({
      user_id: userId,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    // eslint-disable-next-line no-console
    console.error(
      "[user-settings-service] insert user_settings default row failed",
      insertError,
    )
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Supabase failed to create user settings.",
    })
  }

  return mapRowToDto(inserted as UserSettingsRow)
}

/**
 * Update or insert the user's retention_policy in a single upsert-style call.
 */
export async function updateForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  command: UpdateUserSettingsCommand,
): Promise<UserSettingsDto> {
  const nowIso = new Date().toISOString()
  const { data, error } = await client
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        retention_policy: command.retentionPolicy,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[user-settings-service] upsert user_settings failed", error)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Supabase failed to update user settings.",
    })
  }

  return mapRowToDto(data as UserSettingsRow)
}


