import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/db/database.types"
import type {
  CreatePromptVersionCommand,
  CreatePromptVersionResponseDto,
  ErrorDetails,
  PromptEntity,
  PromptId,
  PromptVersionDto,
  PromptVersionEntity,
  PromptVersionId,
  PromptVersionListResponseDto,
  PromptVersionStubDto,
  RestorePromptVersionCommand,
  RestorePromptVersionResponseDto,
  RunEventEntity,
  UserId,
} from "@/types"
import { ApiError } from "@/server/http-errors"

type PromptRow = PromptEntity
type PromptVersionRow = PromptVersionEntity
type RunEventRow = RunEventEntity

// Re-export types for route-layer aliases to keep route files decoupled from
// the full types module surface while still leaning on the central DTOs.
export type CreatePromptVersionCommandAlias = CreatePromptVersionCommand
export type CreatePromptVersionResponseDtoAlias =
  CreatePromptVersionResponseDto

interface ListForPromptParams {
  page: number
  pageSize: number
}

/**
 * List versions for a given prompt and user with simple pagination.
 *
 * The caller is responsible for validating the promptId path param shape and
 * basic page/pageSize semantics. This function enforces ownership and
 * existence of the parent prompt and then returns stubs ordered by
 * created_at DESC.
 */
export async function listForPromptForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  params: ListForPromptParams,
): Promise<PromptVersionListResponseDto> {
  const { page, pageSize } = params
  const offset = (page - 1) * pageSize
  const to = offset + pageSize - 1

  const { data: prompt, error: promptError } = await client
    .from("prompts")
    .select("id")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] listForPromptForUser prompt select failed",
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

  const { data, count, error } = await client
    .from("prompt_versions")
    .select("*", { count: "exact" })
    .eq("prompt_id", promptId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, to)

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] listForPromptForUser versions select failed",
      error,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt versions.",
    })
  }

  const items: PromptVersionStubDto[] = (data ?? []).map((row) => {
    const versionRow = row as PromptVersionRow
    const stub: PromptVersionStubDto = {
      id: versionRow.id as PromptVersionStubDto["id"],
      title: versionRow.title,
      summary: versionRow.summary,
      createdAt: versionRow.created_at,
    }
    return stub
  })

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

/**
 * Load a single version for a prompt and user, enforcing both ownership and
 * the parent-child relationship between prompt and version.
 */
export async function getForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  versionId: PromptVersionId,
): Promise<PromptVersionDto> {
  const { data, error } = await client
    .from("prompt_versions")
    .select("*")
    .eq("id", versionId)
    .eq("prompt_id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] getForUser version select failed",
      error,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt version.",
    })
  }

  if (!data) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt version not found.",
    })
  }

  const row = data as PromptVersionRow

  const dto: PromptVersionDto = {
    id: row.id as PromptVersionDto["id"],
    promptId: row.prompt_id as PromptId,
    title: row.title,
    content: row.content,
    summary: row.summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }

  return dto
}

/**
 * Create a new prompt version for the user and update the parent prompt's
 * current_version_id. When the source is "improve", a run_events row is
 * logged for analytics.
 */
export async function createForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  command: CreatePromptVersionCommand,
): Promise<CreatePromptVersionResponseDto> {
  // Confirm the prompt exists and belongs to the user.
  const { data: promptData, error: promptError } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] createForUser prompt select failed",
      promptError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!promptData) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  const promptRow = promptData as PromptRow

  // If a baseVersionId is provided, ensure it belongs to this prompt and user.
  if (command.baseVersionId) {
    const { data: baseVersion, error: baseVersionError } = await client
      .from("prompt_versions")
      .select("id")
      .eq("id", command.baseVersionId)
      .eq("prompt_id", promptId)
      .eq("user_id", userId)
      .maybeSingle()

    if (baseVersionError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompt-versions-service] createForUser base version select failed",
        baseVersionError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to validate base version.",
      })
    }

    if (!baseVersion) {
      const fieldErrors: ErrorDetails["fieldErrors"] = {
        baseVersionId: [
          "Version does not exist or is not owned by the user for this prompt.",
        ],
      }

      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Base version ID is invalid.",
        details: { fieldErrors },
      })
    }
  }

  const { data: versionInsertData, error: versionInsertError } = await client
    .from("prompt_versions")
    .insert({
      prompt_id: promptRow.id,
      user_id: userId,
      title: command.title,
      content: command.content,
      summary: command.summary ?? null,
      created_by: userId,
    })
    .select()
    .single()

  if (versionInsertError || !versionInsertData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] createForUser prompt_versions insert failed",
      versionInsertError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create prompt version.",
    })
  }

  const versionRow = versionInsertData as PromptVersionRow
  const nowIso = new Date().toISOString()

  const { data: promptUpdateData, error: promptUpdateError } = await client
    .from("prompts")
    .update({
      current_version_id: versionRow.id,
      updated_at: nowIso,
    })
    .eq("id", promptRow.id)
    .eq("user_id", userId)
    .select()
    .single()

  if (promptUpdateError || !promptUpdateData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] createForUser prompts update failed",
      promptUpdateError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to finalize prompt version creation.",
    })
  }

  const updatedPromptRow = promptUpdateData as PromptRow

  if (command.source === "improve") {
    const payload: RunEventRow["payload"] = {
      baseVersionId: command.baseVersionId ?? null,
      newVersionId: versionRow.id,
    }

    const { error: runEventError } = await client.from("run_events").insert({
      user_id: userId,
      prompt_id: promptId,
      event_type: "improve_saved",
      payload,
    })

    if (runEventError) {
      // eslint-disable-next-line no-console
      console.error(
        "[prompt-versions-service] createForUser run_events insert failed",
        runEventError,
      )

      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to log prompt version creation.",
      })
    }
  }

  const versionDto: PromptVersionDto = {
    id: versionRow.id as PromptVersionDto["id"],
    promptId: promptId,
    title: versionRow.title,
    content: versionRow.content,
    summary: versionRow.summary,
    createdBy: versionRow.created_by,
    createdAt: versionRow.created_at,
  }

  const promptDto = {
    id: updatedPromptRow.id as PromptId,
    currentVersionId:
      updatedPromptRow.current_version_id as PromptEntity["current_version_id"],
    updatedAt: updatedPromptRow.updated_at,
  }

  const response: CreatePromptVersionResponseDto = {
    version: versionDto,
    prompt: promptDto,
  }

  return response
}

/**
 * Restore a previous version by creating a new version that copies the
 * content and title from the source version and then updating the parent
 * prompt's current_version_id. A run_events "restore" entry is logged.
 */
export async function restoreForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  versionId: PromptVersionId,
  command: RestorePromptVersionCommand,
): Promise<RestorePromptVersionResponseDto> {
  const { data: promptData, error: promptError } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] restoreForUser prompt select failed",
      promptError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!promptData) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  const { data: sourceVersionData, error: sourceVersionError } = await client
    .from("prompt_versions")
    .select("*")
    .eq("id", versionId)
    .eq("prompt_id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (sourceVersionError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] restoreForUser source version select failed",
      sourceVersionError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt version.",
    })
  }

  if (!sourceVersionData) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt version not found.",
    })
  }

  const sourceVersionRow = sourceVersionData as PromptVersionRow
  const summary =
    command.summary ??
    `Restored from version ${sourceVersionRow.id as string}.`

  const { data: versionInsertData, error: versionInsertError } = await client
    .from("prompt_versions")
    .insert({
      prompt_id: promptId,
      user_id: userId,
      title: sourceVersionRow.title,
      content: sourceVersionRow.content,
      summary,
      created_by: userId,
    })
    .select()
    .single()

  if (versionInsertError || !versionInsertData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] restoreForUser prompt_versions insert failed",
      versionInsertError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create restored prompt version.",
    })
  }

  const newVersionRow = versionInsertData as PromptVersionRow
  const nowIso = new Date().toISOString()

  const { data: promptUpdateData, error: promptUpdateError } = await client
    .from("prompts")
    .update({
      current_version_id: newVersionRow.id,
      updated_at: nowIso,
    })
    .eq("id", promptId)
    .eq("user_id", userId)
    .select()
    .single()

  if (promptUpdateError || !promptUpdateData) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] restoreForUser prompts update failed",
      promptUpdateError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to finalize prompt restore.",
    })
  }

  const updatedPromptRow = promptUpdateData as PromptRow

  const payload: RunEventRow["payload"] = {
    restoredFromVersionId: sourceVersionRow.id,
    newVersionId: newVersionRow.id,
  }

  const { error: runEventError } = await client.from("run_events").insert({
    user_id: userId,
    prompt_id: promptId,
    event_type: "restore",
    payload,
  })

  if (runEventError) {
    // eslint-disable-next-line no-console
    console.error(
      "[prompt-versions-service] restoreForUser run_events insert failed",
      runEventError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to log prompt restore.",
    })
  }

  const versionDto: PromptVersionDto = {
    id: newVersionRow.id as PromptVersionDto["id"],
    promptId,
    title: newVersionRow.title,
    content: newVersionRow.content,
    summary: newVersionRow.summary,
    createdBy: newVersionRow.created_by,
    createdAt: newVersionRow.created_at,
  }

  const promptDto = {
    id: updatedPromptRow.id as PromptId,
    currentVersionId:
      updatedPromptRow.current_version_id as PromptEntity["current_version_id"],
    updatedAt: updatedPromptRow.updated_at,
  }

  const response: RestorePromptVersionResponseDto = {
    version: versionDto,
    prompt: promptDto,
  }

  return response
}


