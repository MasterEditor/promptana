import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorResponseDto,
  GetPromptVersionResponseDto,
  PromptId,
  PromptVersionId,
} from "@/types"
import { handleRouteError } from "@/server/api-route-helpers"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import * as promptVersionsService from "@/server/prompt-versions-service"

type PromptVersionGetSuccessResponse = GetPromptVersionResponseDto
type PromptVersionGetErrorResponse = ErrorResponseDto

/**
 * GET /api/prompts/{promptId}/versions/{versionId}
 *
 * Fetch a single prompt version for the authenticated user, enforcing both
 * ownership and the relationship between the prompt and the version.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ promptId: string; versionId: string }> },
): Promise<
  NextResponse<
    PromptVersionGetSuccessResponse | PromptVersionGetErrorResponse
  >
> {
  try {
    const { promptId: rawPromptId, versionId: rawVersionId } = await context.params
    const promptId = validatePromptId(rawPromptId)
    const versionId = validateVersionId(rawVersionId)

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: "/api/prompts/[promptId]/versions/[versionId]",
    })

    const dto = await promptVersionsService.getForUser(
      client,
      userId,
      promptId,
      versionId,
    )

    return NextResponse.json<PromptVersionGetSuccessResponse>(dto, {
      status: 200,
    })
  } catch (error) {
    return handleRouteError<
      PromptVersionGetSuccessResponse,
      PromptVersionGetErrorResponse
    >(error, "/api/prompts/[promptId]/versions/[versionId]")
  }
}

function validatePromptId(rawPromptId: string): PromptId {
  return assertUuidPathParam("promptId", rawPromptId) as PromptId
}

function validateVersionId(rawVersionId: string): PromptVersionId {
  return assertUuidPathParam("versionId", rawVersionId) as PromptVersionId
}


