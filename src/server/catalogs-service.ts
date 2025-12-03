import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  CatalogDto,
  CatalogEntity,
  CatalogId,
  CatalogListResponseDto,
  CreateCatalogCommand,
  UpdateCatalogCommand,
  UserId,
} from "@/types"
import { ApiError } from "@/server/http-errors"

type CatalogRow = CatalogEntity

function mapRowToDto(row: CatalogRow): CatalogDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface ListForUserParams {
  page: number
  pageSize: number
  search?: string
}

/**
 * List catalogs for a user with basic pagination and optional name search.
 */
export async function listForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  params: ListForUserParams,
): Promise<CatalogListResponseDto> {
  const { page, pageSize, search } = params
  const offset = (page - 1) * pageSize
  const to = offset + pageSize - 1

  let query = client
    .from("catalogs")
    .select("*", { count: "exact" })
    .eq("user_id", userId)

  if (search && search.trim().length > 0) {
    query = query.ilike("name", `%${search.trim()}%`)
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, to)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] listForUser failed", error)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load catalogs.",
    })
  }

  const items = (data ?? []).map((row) => mapRowToDto(row as CatalogRow))

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

/**
 * Create a new catalog for the user, enforcing per-user name uniqueness.
 */
export async function createForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  command: CreateCatalogCommand,
): Promise<CatalogDto> {
  const name = command.name.trim()
  const description = command.description ?? null

  // Optional pre-flight uniqueness check to provide friendlier error messages.
  const { data: existing, error: existingError } = await client
    .from("catalogs")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] pre-check existing catalog failed", existingError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to validate catalog uniqueness.",
    })
  }

  if (existing) {
    throw new ApiError({
      status: 409,
      code: "CONFLICT",
      message: "A catalog with this name already exists.",
    })
  }

  const { data, error } = await client
    .from("catalogs")
    .insert({
      user_id: userId,
      name,
      description,
    })
    .select()
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] createForUser insert failed", error)

    // Map unique violation to a 409 when possible.
    if ((error as { code?: string } | null)?.code === "23505") {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A catalog with this name already exists.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create catalog.",
    })
  }

  return mapRowToDto(data as CatalogRow)
}

/**
 * Update an existing catalog for the user, enforcing name uniqueness.
 */
export async function updateForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  catalogId: CatalogId,
  command: UpdateCatalogCommand,
): Promise<CatalogDto> {
  const { data: existing, error: existingError } = await client
    .from("catalogs")
    .select("*")
    .eq("id", catalogId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] updateForUser select failed", existingError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load catalog.",
    })
  }

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Catalog not found.",
    })
  }

  const updates: Record<string, unknown> = {}

  if (command.name !== undefined) {
    updates.name = command.name.trim()
  }

  if (command.description !== undefined) {
    updates.description = command.description
  }

  // Only perform uniqueness check if name is being changed.
  if (updates.name && updates.name !== (existing as CatalogRow).name) {
    const { data: conflicting, error: conflictError } = await client
      .from("catalogs")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", updates.name as string)
      .neq("id", catalogId)
      .maybeSingle()

    if (conflictError) {
      // eslint-disable-next-line no-console
      console.error(
        "[catalogs-service] updateForUser uniqueness check failed",
        conflictError,
      )
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate catalog uniqueness.",
      })
    }

    if (conflicting) {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A catalog with this name already exists.",
      })
    }
  }

  const nowIso = new Date().toISOString()

  const { data, error } = await client
    .from("catalogs")
    .update({
      ...updates,
      updated_at: nowIso,
    })
    .eq("id", catalogId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] updateForUser update failed", error)

    if ((error as { code?: string } | null)?.code === "23505") {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A catalog with this name already exists.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to update catalog.",
    })
  }

  return mapRowToDto(data as CatalogRow)
}

/**
 * Delete a catalog for the user. Prompts are unassigned from the catalog
 * before deletion to avoid accidental prompt deletion.
 */
export async function deleteForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  catalogId: CatalogId,
): Promise<void> {
  const { data: existing, error: existingError } = await client
    .from("catalogs")
    .select("*")
    .eq("id", catalogId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] deleteForUser select failed", existingError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load catalog.",
    })
  }

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Catalog not found.",
    })
  }

  // Unassign prompts that reference this catalog. This is safe even if the FK
  // is configured as ON DELETE SET NULL – the update will simply be redundant.
  const { error: unassignError } = await client
    .from("prompts")
    .update({ catalog_id: null })
    .eq("catalog_id", catalogId)
    .eq("user_id", userId)

  if (unassignError) {
    // eslint-disable-next-line no-console
    console.error(
      "[catalogs-service] deleteForUser unassign prompts failed",
      unassignError,
    )
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to unassign prompts from catalog.",
    })
  }

  const { error: deleteError } = await client
    .from("catalogs")
    .delete()
    .eq("id", catalogId)
    .eq("user_id", userId)

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error("[catalogs-service] deleteForUser delete failed", deleteError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to delete catalog.",
    })
  }
}


