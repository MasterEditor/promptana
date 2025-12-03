import type {
  JsonValue,
  RunModelMetadataDto,
  RunOptionsDto,
  RunOutputDto,
  RunStatus,
  RunTokenUsageDto,
} from "@/types"
import { ApiError } from "@/server/http-errors"

export interface OpenRouterResultLike {
  status: RunStatus
  output: RunOutputDto | null
  modelMetadata: RunModelMetadataDto | null
  tokenUsage: RunTokenUsageDto | null
  latencyMs: number
  errorMessage?: string | null
}

function buildRequestBody(
  model: string,
  promptText: string,
  variables: Record<string, JsonValue>,
  options: RunOptionsDto | undefined,
): unknown {
  // For now we treat promptText as already-templated content. Variables are
  // passed through in metadata so future iterations can adjust prompting
  // strategy without breaking the API surface.
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: promptText,
      },
    ],
    // Attach variables and options under a vendor-neutral extensions key to
    // keep the primary payload simple.
    extras: {
      variables,
      options,
    },
  }

  if (options?.temperature !== undefined) {
    body.temperature = options.temperature
  }

  if (options?.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens
  }

  return body
}

export async function callOpenRouter(
  model: string,
  promptText: string,
  variables: Record<string, JsonValue>,
  options?: RunOptionsDto,
): Promise<OpenRouterResultLike> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const baseUrl =
    process.env.OPENROUTER_API_BASE_URL ??
    "https://openrouter.ai/api/v1/chat/completions"

  if (!apiKey) {
    throw new ApiError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "OpenRouter environment variables are not configured.",
    })
  }

  const controller = new AbortController()
  const timeoutMs = 30_000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const body = buildRequestBody(model, promptText, variables, options)

  const start = typeof performance !== "undefined" ? performance.now() : Date.now()

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const elapsed =
      typeof performance !== "undefined"
        ? performance.now() - start
        : Date.now() - (start as number)
    const latencyMs = Math.max(0, Math.round(elapsed))

    let json: unknown
    try {
      json = await response.json()
    } catch {
      json = null
    }

    const safeJson = json as
      | {
          choices?: Array<{
            message?: { content?: string | null }
          }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          }
          error?: { message?: string }
        }
      | null

    let status: RunStatus = "success"
    let output: RunOutputDto | null = null
    let tokenUsage: RunTokenUsageDto | null = null
    let errorMessage: string | null = null

    if (!response.ok) {
      status = response.status === 504 ? "timeout" : "error"
      errorMessage =
        safeJson?.error?.message ??
        `OpenRouter request failed with status ${response.status}.`
    } else {
      const text = safeJson?.choices?.[0]?.message?.content ?? ""
      output = text ? { text } : {}

      if (safeJson?.usage) {
        tokenUsage = {
          inputTokens: safeJson.usage.prompt_tokens ?? 0,
          outputTokens: safeJson.usage.completion_tokens ?? 0,
          totalTokens: safeJson.usage.total_tokens,
        }
      }
    }

    const modelMetadata: RunModelMetadataDto = {
      provider: "openrouter",
      raw: safeJson as unknown as JsonValue,
    }

    return {
      status,
      output,
      modelMetadata,
      tokenUsage,
      latencyMs,
      errorMessage,
    }
  } catch (error) {
    const elapsed =
      typeof performance !== "undefined"
        ? performance.now() - start
        : Date.now() - (start as number)
    const latencyMs = Math.max(0, Math.round(elapsed))

    const isAbortError =
      error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")

    return {
      status: isAbortError ? "timeout" : "error",
      output: null,
      modelMetadata: null,
      tokenUsage: null,
      latencyMs,
      errorMessage: isAbortError
        ? "OpenRouter request timed out."
        : "Failed to call OpenRouter.",
    }
  } finally {
    clearTimeout(timeoutId)
  }
}


