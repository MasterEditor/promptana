import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/db/database.types"
import type {
  CreateRunCommand,
  CreateRunResponseDto,
  GetRunResponseDto,
  PromptEntity,
  PromptId,
  RunDto,
  RunEntity,
  RunEventEntity,
  RunId,
  RunListItemDto,
  RunListResponseDto,
  RunStatus,
  UserId,
} from "@/types"
import { ApiError } from "@/server/http-errors"
import type { OpenRouterResultLike } from "@/server/openrouter-service"

type RunRow = RunEntity
type PromptRow = PromptEntity
type RunEventRow = RunEventEntity

interface ListForPromptParams {
  page: number
  pageSize: number
  status?: RunStatus
}

export async function assertPromptExistsForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
): Promise<PromptRow> {
  const { data, error } = await client
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] assertPromptExistsForUser prompt select failed",
      error,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  if (!data) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Prompt not found.",
    })
  }

  return data as PromptRow
}

export async function listForPromptForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  params: ListForPromptParams,
): Promise<RunListResponseDto> {
  const { page, pageSize, status } = params
  const offset = (page - 1) * pageSize
  const to = offset + pageSize - 1

  const { error: promptError } = await client
    .from("prompts")
    .select("id")
    .eq("id", promptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (promptError) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] listForPromptForUser prompt select failed",
      promptError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load prompt.",
    })
  }

  let query = client
    .from("runs")
    .select("*", { count: "exact" })
    .eq("prompt_id", promptId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, count, error } = await query.range(offset, to)

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] listForPromptForUser runs select failed",
      error,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load runs.",
    })
  }

  const rows = (data ?? []) as RunRow[]

  const items: RunListItemDto[] = rows.map((row) => ({
    id: row.id as RunListItemDto["id"],
    status: row.status,
    model: row.model,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  }))

  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  }
}

export async function getForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  runId: RunId,
): Promise<GetRunResponseDto> {
  const { data, error } = await client
    .from("runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[runs-service] getForUser run select failed", error)

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to load run.",
    })
  }

  if (!data) {
    throw new ApiError({
      status: 404,
      code: "NOT_FOUND",
      message: "Run not found.",
    })
  }

  const row = data as RunRow

  return mapRunRowToDto(row)
}

export async function createForUser(
  client: SupabaseClient<Database>,
  userId: UserId,
  promptId: PromptId,
  command: CreateRunCommand,
  result: OpenRouterResultLike,
): Promise<CreateRunResponseDto> {
  const promptRow = await assertPromptExistsForUser(client, userId, promptId)

  const status: RunStatus = result.status
  const latencyMs = Math.max(0, Math.round(result.latencyMs ?? 0))

  const { data: insertData, error: insertError } = await client
    .from("runs")
    .insert({
      prompt_id: promptRow.id,
      user_id: userId,
      model: command.model,
      status,
      input: command.input as Json,
      output: result.output as Json,
      model_metadata: result.modelMetadata as Json,
      token_usage: result.tokenUsage as Json,
      latency_ms: latencyMs,
      error_message: result.errorMessage ?? null,
    })
    .select()
    .single()

  if (insertError || !insertData) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] createForUser runs insert failed",
      insertError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to create run.",
    })
  }

  const runRow = insertData as RunRow
  const nowIso = new Date().toISOString()

  const { error: promptUpdateError } = await client
    .from("prompts")
    .update({
      last_run_id: runRow.id,
      updated_at: nowIso,
    })
    .eq("id", promptRow.id)
    .eq("user_id", userId)

  if (promptUpdateError) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] createForUser prompts update failed",
      promptUpdateError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to finalize run creation.",
    })
  }

  const payload: RunEventRow["payload"] = {
    runId: runRow.id,
    model: runRow.model,
    status: runRow.status,
    latencyMs: runRow.latency_ms,
    tokenUsage: runRow.token_usage,
    errorMessage: runRow.error_message,
  }

  const { error: runEventError } = await client.from("run_events").insert({
    user_id: userId,
    prompt_id: promptId,
    event_type: "run",
    payload,
  })

  if (runEventError) {
    // eslint-disable-next-line no-console
    console.error(
      "[runs-service] createForUser run_events insert failed",
      runEventError,
    )

    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Failed to log run.",
    })
  }

  const dto: RunDto = mapRunRowToDto(runRow)

  return {
    run: dto,
  }
}

function mapRunRowToDto(row: RunRow): RunDto {
  return {
    id: row.id as RunDto["id"],
    promptId: row.prompt_id as PromptId,
    userId: row.user_id as UserId,
    model: row.model,
    status: row.status,
    input: row.input as RunDto["input"],
    output: row.output as RunDto["output"],
    modelMetadata: row.model_metadata as RunDto["modelMetadata"],
    tokenUsage: row.token_usage as RunDto["tokenUsage"],
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}


