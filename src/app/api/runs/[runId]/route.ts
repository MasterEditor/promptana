import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type {
  ErrorResponseDto,
  GetRunResponseDto,
  RunId,
} from "@/types"
import { handleRouteError } from "@/server/api-route-helpers"
import { getSupabaseClientAndUserId } from "@/server/supabase-auth"
import { assertUuidPathParam } from "@/server/validation"
import * as runsService from "@/server/runs-service"

type RunDetailSuccessResponse = GetRunResponseDto
type RunDetailErrorResponse = ErrorResponseDto

const ROUTE_ID = "/api/runs/[runId]"

export async function GET(
  request: NextRequest,
  context: { params: { runId: string } },
): Promise<NextResponse<RunDetailSuccessResponse | RunDetailErrorResponse>> {
  try {
    const runId = assertUuidPathParam("runId", context.params.runId) as RunId

    const { client, userId } = await getSupabaseClientAndUserId(request, {
      routeId: ROUTE_ID,
    })

    const dto = await runsService.getForUser(client, userId, runId)

    return NextResponse.json<RunDetailSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<RunDetailSuccessResponse, RunDetailErrorResponse>(
      error,
      ROUTE_ID,
    )
  }
}



