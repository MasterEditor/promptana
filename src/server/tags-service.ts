import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  PromptId,
  PromptTagsDto,
  ReplacePromptTagsCommand,
  TagDto,
  TagEntity,
  TagId,
  TagListResponseDto,
  CreateTagCommand,
  UpdateTagCommand,
  UserId,
  ErrorDetails,
} from "@/types"
import { ApiError } from "@/server/http-errors"

type TagRow = TagEntity

function mapTagRowToDto(row: TagRow): TagDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }
}

interface ListForUserParams {
  page: number
  pageSize: number
  search?: string
}

/**
 * List tags for a user with basic pagination and optional name search.
 */
export async function listForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  params: ListForUserParams,
): Promise<TagListResponseDto> {
  const { page, pageSize, search } = params
  const offset = (page - 1) * pageSize
  const to = offset + pageSize - 1

  let query = client
    .from("tags")
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
    console.error("[tags-service] listForUser failed", error)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load tags.",
    })
  }

  const items = (data ?? []).map((row) => mapTagRowToDto(row as TagRow))

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

/**
 * Create a new tag for the user, enforcing per-user name uniqueness.
 */
export async function createForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  command: CreateTagCommand,
): Promise<TagDto> {
  const name = command.name.trim()

  // Optional pre-flight uniqueness check for a nicer error message.
  const { data: existing, error: existingError } = await client
    .from("tags")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error(
      "[tags-service] createForUser pre-check existing tag failed",
      existingError,
    )
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to validate tag uniqueness.",
    })
  }

  if (existing) {
    throw new ApiError({
      status: 409,
      code: "CONFLICT",
      message: "A tag with this name already exists.",
    })
  }

  const { data, error } = await client
    .from("tags")
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[tags-service] createForUser insert failed", error)

    if ((error as { code?: string } | null)?.code === "23505") {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A tag with this name already exists.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create tag.",
    })
  }

  return mapTagRowToDto(data as TagRow)
}

/**
 * Update an existing tag for the user, enforcing per-user name uniqueness.
 */
export async function updateForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  tagId: TagId,
  command: UpdateTagCommand,
): Promise<TagDto> {
  const { data: existing, error: existingError } = await client
    .from("tags")
    .select("*")
    .eq("id", tagId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[tags-service] updateForUser select failed", existingError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load tag.",
    })
  }

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Tag not found.",
    })
  }

  const updates: Record<string, unknown> = {}

  if (command.name !== undefined) {
    updates.name = command.name.trim()
  }

  // Only perform uniqueness check if name is being changed.
  if (updates.name && updates.name !== (existing as TagRow).name) {
    const { data: conflicting, error: conflictError } = await client
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", updates.name as string)
      .neq("id", tagId)
      .maybeSingle()

    if (conflictError) {
      // eslint-disable-next-line no-console
      console.error(
        "[tags-service] updateForUser uniqueness check failed",
        conflictError,
      )
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate tag uniqueness.",
      })
    }

    if (conflicting) {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A tag with this name already exists.",
      })
    }
  }

  const { data, error } = await client
    .from("tags")
    .update(updates)
    .eq("id", tagId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[tags-service] updateForUser update failed", error)

    if ((error as { code?: string } | null)?.code === "23505") {
      throw new ApiError({
        status: 409,
        code: "CONFLICT",
        message: "A tag with this name already exists.",
      })
    }

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to update tag.",
    })
  }

  return mapTagRowToDto(data as TagRow)
}

/**
 * Delete a tag for the user. Associated prompt_tags rows are expected to be
 * cleaned up via ON DELETE CASCADE on the tag_id foreign key.
 */
export async function deleteForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  tagId: TagId,
): Promise<void> {
  const { data: existing, error: existingError } = await client
    .from("tags")
    .select("*")
    .eq("id", tagId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error("[tags-service] deleteForUser select failed", existingError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load tag.",
    })
  }

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Tag not found.",
    })
  }

  const { error: deleteError } = await client
    .from("tags")
    .delete()
    .eq("id", tagId)
    .eq("user_id", userId)

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error("[tags-service] deleteForUser delete failed", deleteError)
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to delete tag.",
    })
  }
}

/**
 * Replace the tags associated with a prompt for the user.
 *
 * This function:
 * - Verifies the prompt exists and belongs to the user.
 * - Ensures all provided tagIds exist and are owned by the user.
 * - Clears existing prompt_tags rows for the prompt/user.
 * - Inserts a new set of prompt_tags rows for the provided tagIds.
 *
 * All higher-level validation (UUID shape, max counts, duplicates) is
 * expected to be performed at the route layer.
 */
export async function replacePromptTags(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  command: ReplacePromptTagsCommand,
): Promise<PromptTagsDto> {
  const { data: prompt, error: promptError } = await client
    .from("prompts")
    .select("id")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[tags-service] replacePromptTags prompt select failed",
      promptError,
    )
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!prompt) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  const uniqueTagIds = Array.from(new Set(command.tagIds))

  if (uniqueTagIds.length > 0) {
    const { data: tags, error: tagsError } = await client
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .in("id", uniqueTagIds)

    if (tagsError) {
      // eslint-disable-next-line no-console
      console.error(
        "[tags-service] replacePromptTags tags select failed",
        tagsError,
      )
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to load tags.",
      })
    }

    const foundIds = new Set((tags ?? []).map((row) => row.id as TagId))

    if (foundIds.size !== uniqueTagIds.length) {
      const fieldErrors: ErrorDetails["fieldErrors"] = {
        tagIds: ["One or more tags do not exist or are not owned by the user."],
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Tag IDs are invalid.",
        details: { fieldErrors },
      })
    }
  }

  const { error: deleteError } = await client
    .from("prompt_tags")
    .delete()
    .eq("prompt_id", promptId)
    .eq("user_id", userId)

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error(
      "[tags-service] replacePromptTags delete existing failed",
      deleteError,
    )
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to clear existing prompt tags.",
    })
  }

  if (uniqueTagIds.length > 0) {
    const rows = uniqueTagIds.map((tagId) => ({
      prompt_id: promptId,
      tag_id: tagId,
      user_id: userId,
    }))

    const { error: insertError } = await client
      .from("prompt_tags")
      .insert(rows)

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error(
        "[tags-service] replacePromptTags insert failed",
        insertError,
      )
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to assign tags to prompt.",
      })
    }
  }

  const dto: PromptTagsDto = {
    promptId,
    tagIds: uniqueTagIds,
  }

  return dto
}


