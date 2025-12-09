import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorDetails,
  ErrorResponseDto,
  ImprovePromptCommand,
  ImprovePromptResponseDto,
  ImproveSuggestionDto,
  PromptId,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import { callOpenRouter } from "@/server/openrouter-service"

type ImproveSuccessResponse = ImprovePromptResponseDto
type ImproveErrorResponse = ErrorResponseDto

const ROUTE_ID = "/api/prompts/[promptId]/improve"

const MAX_MODEL_LENGTH = 255
const MAX_CURRENT_PROMPT_LENGTH = 100_000
const MAX_GOALS_LENGTH = 2000
const MAX_CONSTRAINTS_LENGTH = 2000
const MIN_SUGGESTIONS = 1
const MAX_SUGGESTIONS = 5
const DEFAULT_SUGGESTIONS = 3

const ALLOWED_MODELS = new Set<string>([
  "openai/gpt-3.5-turbo",
])

const IMPROVE_SYSTEM_PROMPT = `You are an expert prompt engineer. Your task is to improve the given prompt to make it more effective, clear, and likely to produce better results from an AI assistant.

Analyze the prompt and provide improved versions. For each suggestion:
1. Make the prompt clearer and more specific
2. Add structure where helpful (e.g., sections, bullet points)
3. Include relevant context or constraints
4. Improve the tone and language for better AI understanding
5. Consider edge cases and clarify expected output format

Return your response as a JSON object with the following structure:
{
  "suggestions": [
    {
      "title": "Short descriptive title for this version",
      "content": "The improved prompt text",
      "summary": "Brief explanation of what was improved"
    }
  ]
}

Return exactly the number of suggestions requested. Each suggestion should be meaningfully different from the others.`

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ promptId: string }> },
): Promise<NextResponse<ImproveSuccessResponse | ImproveErrorResponse>> {
  try {
    const { promptId: rawPromptId } = await context.params
    const promptId = assertUuidPathParam(
      "promptId",
      rawPromptId,
    ) as PromptId

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: ROUTE_ID,
    })

    const rawBody = await parseJsonBody(request)
    const command = validateImproveBody(rawBody)

    // Verify prompt exists and belongs to user
    const { data: promptData, error: promptError } = await client
      .from("prompts")
      .select("id")
      .eq("id", promptId)
      .eq("user_id", userId)
      .maybeSingle()

    if (promptError) {
      // eslint-disable-next-line no-console
      console.error("[improve-route] POST prompt select failed", promptError)

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

    const numSuggestions = command.input.numSuggestions ?? DEFAULT_SUGGESTIONS

    // Build the user message for improvement
    let userMessage = `Please improve the following prompt and provide ${numSuggestions} suggestion(s).

## Current Prompt:
${command.input.currentPrompt}`

    if (command.input.goals) {
      userMessage += `

## Goals:
${command.input.goals}`
    }

    if (command.input.constraints) {
      userMessage += `

## Constraints:
${command.input.constraints}`
    }

    // Call OpenRouter with the system prompt for improvement
    const openRouterResult = await callOpenRouterForImprove(
      command.model,
      IMPROVE_SYSTEM_PROMPT,
      userMessage,
      command.options,
    )

    if (openRouterResult.status !== "success" || !openRouterResult.output?.text) {
      throw new ApiError({
        status: 500,
        code: "OPENROUTER_ERROR",
        message:
          openRouterResult.errorMessage ??
          "The model failed to generate improvement suggestions.",
      })
    }

    // Parse the response JSON
    const suggestions = parseImproveSuggestions(
      openRouterResult.output.text,
      command.model,
      openRouterResult.tokenUsage,
    )

    // Log run_events with event_type = "improve"
    const { error: eventError } = await client.from("run_events").insert({
      user_id: userId,
      prompt_id: promptId,
      event_type: "improve",
      payload: {
        model: command.model,
        suggestionsCount: suggestions.length,
        latencyMs: openRouterResult.latencyMs,
        tokenUsage: openRouterResult.tokenUsage,
      },
    })

    if (eventError) {
      // eslint-disable-next-line no-console
      console.error("[improve-route] POST run_events insert failed", eventError)
      // Non-critical error, don't fail the request
    }

    const responseDto: ImprovePromptResponseDto = {
      suggestions,
      latencyMs: openRouterResult.latencyMs,
    }

    return NextResponse.json<ImproveSuccessResponse>(responseDto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<ImproveSuccessResponse, ImproveErrorResponse>(
      error,
      ROUTE_ID,
    )
  }
}

async function callOpenRouterForImprove(
  model: string,
  systemPrompt: string,
  userMessage: string,
  options?: ImprovePromptCommand["options"],
) {
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
  const timeoutMs = 60_000 // 60 seconds for improve calls
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    response_format: { type: "json_object" },
  }

  if (options?.temperature !== undefined) {
    body.temperature = options.temperature
  } else {
    body.temperature = 0.9 // Higher temperature for creative suggestions
  }

  if (options?.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens
  } else {
    body.max_tokens = 4096 // Allow longer responses for multiple suggestions
  }

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

    if (!response.ok) {
      return {
        status: response.status === 504 ? ("timeout" as const) : ("error" as const),
        output: null,
        tokenUsage: null,
        latencyMs,
        errorMessage:
          safeJson?.error?.message ??
          `OpenRouter request failed with status ${response.status}.`,
      }
    }

    const text = safeJson?.choices?.[0]?.message?.content ?? ""

    return {
      status: "success" as const,
      output: { text },
      tokenUsage: safeJson?.usage
        ? {
            inputTokens: safeJson.usage.prompt_tokens ?? 0,
            outputTokens: safeJson.usage.completion_tokens ?? 0,
            totalTokens: safeJson.usage.total_tokens,
          }
        : null,
      latencyMs,
      errorMessage: null,
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
      status: isAbortError ? ("timeout" as const) : ("error" as const),
      output: null,
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

function parseImproveSuggestions(
  responseText: string,
  model: string,
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens?: number } | null,
): ImproveSuggestionDto[] {
  try {
    const parsed = JSON.parse(responseText) as {
      suggestions?: Array<{
        title?: string
        content?: string
        summary?: string
      }>
    }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error("Invalid response format: missing suggestions array")
    }

    return parsed.suggestions.map((suggestion, index) => ({
      id: `suggestion-${index + 1}`,
      title: suggestion.title ?? `Improved Version ${index + 1}`,
      content: suggestion.content ?? "",
      summary: suggestion.summary,
      model,
      tokenUsage: tokenUsage
        ? {
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            totalTokens: tokenUsage.totalTokens,
          }
        : undefined,
    }))
  } catch {
    // If JSON parsing fails, try to extract content as a single suggestion
    return [
      {
        id: "suggestion-1",
        title: "Improved Version",
        content: responseText,
        summary: "AI-generated improvement",
        model,
        tokenUsage: tokenUsage
          ? {
              inputTokens: tokenUsage.inputTokens,
              outputTokens: tokenUsage.outputTokens,
              totalTokens: tokenUsage.totalTokens,
            }
          : undefined,
      },
    ]
  }
}

function validateImproveBody(payload: unknown): ImprovePromptCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object.",
    })
  }

  const body = payload as Record<string, unknown>
  const allowedKeys = new Set(["model", "input", "options"])

  const structuralFieldErrors: ErrorDetails["fieldErrors"] = {}
  const semanticFieldErrors: ErrorDetails["fieldErrors"] = {}

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      structuralFieldErrors[key] = ["Unknown field."]
    }
  }

  const rawModel = body.model
  const rawInput = body.input
  const rawOptions = body.options

  // model – required, string, allow-listed
  if (rawModel === undefined) {
    structuralFieldErrors.model = [
      ...(structuralFieldErrors.model ?? []),
      "Field is required.",
    ]
  } else if (typeof rawModel !== "string") {
    structuralFieldErrors.model = [
      ...(structuralFieldErrors.model ?? []),
      "Must be a string.",
    ]
  } else {
    const trimmed = rawModel.trim()

    if (trimmed.length === 0) {
      semanticFieldErrors.model = [
        ...(semanticFieldErrors.model ?? []),
        "Must not be empty.",
      ]
    } else if (trimmed.length > MAX_MODEL_LENGTH) {
      semanticFieldErrors.model = [
        ...(semanticFieldErrors.model ?? []),
        `Must be at most ${MAX_MODEL_LENGTH} characters long.`,
      ]
    } else if (!ALLOWED_MODELS.has(trimmed)) {
      semanticFieldErrors.model = [
        ...(semanticFieldErrors.model ?? []),
        "Model is not allowed.",
      ]
    }
  }

  // input – required object
  if (rawInput === undefined) {
    structuralFieldErrors.input = [
      ...(structuralFieldErrors.input ?? []),
      "Field is required.",
    ]
  } else if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    structuralFieldErrors.input = [
      ...(structuralFieldErrors.input ?? []),
      "Must be an object.",
    ]
  }

  let currentPrompt: string | null = null
  let goals: string | undefined
  let constraints: string | undefined
  let numSuggestions: number | undefined

  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    const inputObj = rawInput as Record<string, unknown>
    const rawCurrentPrompt = inputObj.currentPrompt
    const rawGoals = inputObj.goals
    const rawConstraints = inputObj.constraints
    const rawNumSuggestions = inputObj.numSuggestions

    // currentPrompt – required, string
    if (rawCurrentPrompt === undefined) {
      structuralFieldErrors["input.currentPrompt"] = [
        ...(structuralFieldErrors["input.currentPrompt"] ?? []),
        "Field is required.",
      ]
    } else if (typeof rawCurrentPrompt !== "string") {
      structuralFieldErrors["input.currentPrompt"] = [
        ...(structuralFieldErrors["input.currentPrompt"] ?? []),
        "Must be a string.",
      ]
    } else {
      const trimmed = rawCurrentPrompt.trim()
      if (trimmed.length === 0) {
        semanticFieldErrors["input.currentPrompt"] = [
          ...(semanticFieldErrors["input.currentPrompt"] ?? []),
          "Must not be empty.",
        ]
      } else if (trimmed.length > MAX_CURRENT_PROMPT_LENGTH) {
        semanticFieldErrors["input.currentPrompt"] = [
          ...(semanticFieldErrors["input.currentPrompt"] ?? []),
          `Must be at most ${MAX_CURRENT_PROMPT_LENGTH} characters long.`,
        ]
      } else {
        currentPrompt = trimmed
      }
    }

    // goals – optional string
    if (rawGoals !== undefined && rawGoals !== null) {
      if (typeof rawGoals !== "string") {
        structuralFieldErrors["input.goals"] = [
          ...(structuralFieldErrors["input.goals"] ?? []),
          "Must be a string.",
        ]
      } else if (rawGoals.length > MAX_GOALS_LENGTH) {
        semanticFieldErrors["input.goals"] = [
          ...(semanticFieldErrors["input.goals"] ?? []),
          `Must be at most ${MAX_GOALS_LENGTH} characters long.`,
        ]
      } else {
        goals = rawGoals.trim() || undefined
      }
    }

    // constraints – optional string
    if (rawConstraints !== undefined && rawConstraints !== null) {
      if (typeof rawConstraints !== "string") {
        structuralFieldErrors["input.constraints"] = [
          ...(structuralFieldErrors["input.constraints"] ?? []),
          "Must be a string.",
        ]
      } else if (rawConstraints.length > MAX_CONSTRAINTS_LENGTH) {
        semanticFieldErrors["input.constraints"] = [
          ...(semanticFieldErrors["input.constraints"] ?? []),
          `Must be at most ${MAX_CONSTRAINTS_LENGTH} characters long.`,
        ]
      } else {
        constraints = rawConstraints.trim() || undefined
      }
    }

    // numSuggestions – optional integer
    if (rawNumSuggestions !== undefined && rawNumSuggestions !== null) {
      if (!Number.isInteger(rawNumSuggestions)) {
        structuralFieldErrors["input.numSuggestions"] = [
          ...(structuralFieldErrors["input.numSuggestions"] ?? []),
          "Must be an integer.",
        ]
      } else if (
        (rawNumSuggestions as number) < MIN_SUGGESTIONS ||
        (rawNumSuggestions as number) > MAX_SUGGESTIONS
      ) {
        semanticFieldErrors["input.numSuggestions"] = [
          ...(semanticFieldErrors["input.numSuggestions"] ?? []),
          `Must be between ${MIN_SUGGESTIONS} and ${MAX_SUGGESTIONS}.`,
        ]
      } else {
        numSuggestions = rawNumSuggestions as number
      }
    }
  }

  // options – optional object
  let options: ImprovePromptCommand["options"]
  if (rawOptions !== undefined) {
    if (!rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) {
      structuralFieldErrors.options = [
        ...(structuralFieldErrors.options ?? []),
        "Must be an object.",
      ]
    } else {
      const optionsObj = rawOptions as Record<string, unknown>

      const rawTemperature = optionsObj.temperature
      const rawMaxTokens = optionsObj.maxTokens

      if (rawTemperature !== undefined) {
        if (typeof rawTemperature !== "number" || Number.isNaN(rawTemperature)) {
          structuralFieldErrors["options.temperature"] = [
            ...(structuralFieldErrors["options.temperature"] ?? []),
            "Must be a number.",
          ]
        }
      }

      if (rawMaxTokens !== undefined) {
        if (!Number.isInteger(rawMaxTokens)) {
          structuralFieldErrors["options.maxTokens"] = [
            ...(structuralFieldErrors["options.maxTokens"] ?? []),
            "Must be an integer.",
          ]
        }
      }

      options = {
        temperature:
          typeof rawTemperature === "number" && !Number.isNaN(rawTemperature)
            ? rawTemperature
            : undefined,
        maxTokens:
          typeof rawMaxTokens === "number" && Number.isInteger(rawMaxTokens)
            ? (rawMaxTokens as number)
            : undefined,
      }
    }
  }

  if (Object.keys(semanticFieldErrors).length > 0) {
    throw new ApiError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Validation failed.",
      details: { fieldErrors: semanticFieldErrors },
    })
  }

  if (Object.keys(structuralFieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body is invalid.",
      details: { fieldErrors: structuralFieldErrors },
    })
  }

  const model = (body.model as string).trim()

  const command: ImprovePromptCommand = {
    model,
    input: {
      currentPrompt: currentPrompt!,
      goals,
      constraints,
      numSuggestions,
    },
  }

  if (options) {
    command.options = options
  }

  return command
}
