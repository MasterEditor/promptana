import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  CreateRunCommand,
  CreateRunResponseDto,
  ErrorDetails,
  ErrorResponseDto,
  PromptId,
  RunListResponseDto,
  RunStatus,
} from "@/types"
import { handleRouteError, parseJsonBody } from "@/server/api-route-helpers"
import { ApiError } from "@/server/http-errors"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import * as runsService from "@/server/runs-service"
import { callOpenRouter } from "@/server/openrouter-service"
import {
  checkAndIncrementRunQuota,
  checkRunRateLimit,
} from "@/server/quota-service"

type RunsListSuccessResponse = RunListResponseDto
type RunsCreateSuccessResponse = CreateRunResponseDto
type RunsErrorResponse = ErrorResponseDto

const ROUTE_ID = "/api/prompts/[promptId]/runs"

const MAX_MODEL_LENGTH = 255
const MAX_OVERRIDE_PROMPT_LENGTH = 100_000
const MAX_VARIABLE_KEYS = 100

const ALLOWED_RUN_STATUSES: RunStatus[] = [
  "pending",
  "success",
  "error",
  "timeout",
]

const ALLOWED_MODELS = new Set<string>([
  // Default to a small, conservative allow-list. This can be extended via env
  // configuration or a dedicated models endpoint in a future iteration.
  "openrouter/auto",
])

export async function GET(
  request: NextRequest,
  context: { params: { promptId: string } },
): Promise<NextResponse<RunsListSuccessResponse | RunsErrorResponse>> {
  try {
    const promptId = assertUuidPathParam(
      "promptId",
      context.params.promptId,
    ) as PromptId

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: ROUTE_ID,
    })

    const { page, pageSize, status } = validateListRunsQuery(
      request.nextUrl.searchParams,
    )

    const dto = await runsService.listForPromptForUser(client, userId, promptId, {
      page,
      pageSize,
      status,
    })

    return NextResponse.json<RunsListSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<RunsListSuccessResponse, RunsErrorResponse>(
      error,
      ROUTE_ID,
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { promptId: string } },
): Promise<NextResponse<RunsCreateSuccessResponse | RunsErrorResponse>> {
  try {
    const promptId = assertUuidPathParam(
      "promptId",
      context.params.promptId,
    ) as PromptId

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: ROUTE_ID,
    })

    const rawBody = await parseJsonBody(request)
    const command = validateCreateRunBody(rawBody)

    await checkAndIncrementRunQuota(userId)

    const ipHeader =
      request.headers.get("x-forwarded-for") ?? request.headers.get("X-Forwarded-For")
    const ip = ipHeader ? ipHeader.split(",")[0]?.trim() ?? null : null

    await checkRunRateLimit(userId, ip)

    // Determine the effective prompt text: prefer overridePrompt when provided
    // and non-empty; otherwise load the current version content for the prompt.
    const overridePrompt =
      command.input.overridePrompt && command.input.overridePrompt.trim().length > 0
        ? command.input.overridePrompt
        : null

    let effectivePrompt: string

    if (overridePrompt) {
      effectivePrompt = overridePrompt
    } else {
      const { data: versionData, error: versionError } = await client
        .from("prompts")
        .select("current_version_id, prompt_versions!inner(content)")
        .eq("id", promptId)
        .eq("user_id", userId)
        .maybeSingle()

      if (versionError) {
        // eslint-disable-next-line no-console
        console.error(
          "[runs-route] POST current version select failed",
          versionError,
        )

        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to load prompt content.",
        })
      }

      if (
        !versionData ||
        !Array.isArray(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (versionData as any).prompt_versions,
        ) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !(versionData as any).prompt_versions[0]?.content
      ) {
        const fieldErrors: ErrorDetails["fieldErrors"] = {
          promptId: ["Prompt has no current version to execute."],
        }

        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Prompt cannot be executed.",
          details: { fieldErrors },
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      effectivePrompt = (versionData as any).prompt_versions[0].content as string
    }

    const openRouterResult = await callOpenRouter(
      command.model,
      effectivePrompt,
      command.input.variables,
      command.options,
    )

    const dto = await runsService.createForUser(
      client,
      userId,
      promptId,
      command,
      openRouterResult,
    )

    if (openRouterResult.status !== "success") {
      throw new ApiError({
        status: 500,
        code: "OPENROUTER_ERROR",
        message:
          openRouterResult.errorMessage ??
          "The model failed to generate a response.",
      })
    }

    return NextResponse.json<RunsCreateSuccessResponse>(dto, {
      status: 201,
    })
  } catch (error) {
    return handleRouteError<RunsCreateSuccessResponse, RunsErrorResponse>(
      error,
      ROUTE_ID,
    )
  }
}

function validateListRunsQuery(
  searchParams: URLSearchParams,
): { page: number; pageSize: number; status?: RunStatus } {
  const rawPage = searchParams.get("page")
  const rawPageSize = searchParams.get("pageSize")
  const rawStatus = searchParams.get("status")

  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  let page = 1
  if (rawPage !== null) {
    const parsed = Number(rawPage)
    if (!Number.isInteger(parsed)) {
      fieldErrors.page = ["Must be an integer."]
    } else if (parsed < 1) {
      fieldErrors.page = ["Must be greater than or equal to 1."]
    } else {
      page = parsed
    }
  }

  let pageSize = 20
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize)
    if (!Number.isInteger(parsed)) {
      fieldErrors.pageSize = ["Must be an integer."]
    } else if (parsed < 1 || parsed > 100) {
      fieldErrors.pageSize = ["Must be between 1 and 100."]
    } else {
      pageSize = parsed
    }
  }

  let status: RunStatus | undefined
  if (rawStatus !== null) {
    if (!ALLOWED_RUN_STATUSES.includes(rawStatus as RunStatus)) {
      fieldErrors.status = [
        "Must be one of pending, success, error, or timeout.",
      ]
    } else {
      status = rawStatus as RunStatus
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Query parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return { page, pageSize, status }
}

function validateCreateRunBody(payload: unknown): CreateRunCommand {
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

  // input – required object with variables and optional overridePrompt
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

  let variables: Record<string, unknown> | null = null
  let overridePrompt: string | null | undefined

  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    const inputObj = rawInput as Record<string, unknown>
    const rawVariables = inputObj.variables
    const rawOverridePrompt = inputObj.overridePrompt

    if (rawVariables === undefined) {
      structuralFieldErrors["input.variables"] = [
        ...(structuralFieldErrors["input.variables"] ?? []),
        "Field is required.",
      ]
    } else if (
      rawVariables === null ||
      typeof rawVariables !== "object" ||
      Array.isArray(rawVariables)
    ) {
      structuralFieldErrors["input.variables"] = [
        ...(structuralFieldErrors["input.variables"] ?? []),
        "Must be an object.",
      ]
    } else {
      variables = rawVariables as Record<string, unknown>

      const keys = Object.keys(variables)
      if (keys.length > MAX_VARIABLE_KEYS) {
        semanticFieldErrors["input.variables"] = [
          ...(semanticFieldErrors["input.variables"] ?? []),
          `Must not contain more than ${MAX_VARIABLE_KEYS} variables.`,
        ]
      }
    }

    if (rawOverridePrompt !== undefined && rawOverridePrompt !== null) {
      if (typeof rawOverridePrompt !== "string") {
        structuralFieldErrors["input.overridePrompt"] = [
          ...(structuralFieldErrors["input.overridePrompt"] ?? []),
          "Must be a string or null.",
        ]
      } else {
        const trimmed = rawOverridePrompt.trim()
        if (trimmed.length === 0) {
          semanticFieldErrors["input.overridePrompt"] = [
            ...(semanticFieldErrors["input.overridePrompt"] ?? []),
            "Must not be empty when provided.",
          ]
        } else if (trimmed.length > MAX_OVERRIDE_PROMPT_LENGTH) {
          semanticFieldErrors["input.overridePrompt"] = [
            ...(semanticFieldErrors["input.overridePrompt"] ?? []),
            `Must be at most ${MAX_OVERRIDE_PROMPT_LENGTH} characters long.`,
          ]
        } else {
          overridePrompt = trimmed
        }
      }
    }
  }

  // options – optional object with known numeric fields
  let options: CreateRunCommand["options"]
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

  const input: CreateRunCommand["input"] = {
    variables: (variables ?? {}) as CreateRunCommand["input"]["variables"],
  }

  if (overridePrompt !== undefined) {
    input.overridePrompt = overridePrompt
  }

  const command: CreateRunCommand = {
    model,
    input,
  }

  if (options) {
    command.options = options
  }

  return command
}



