import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type { CurrentUserDto, ErrorResponseDto } from "@/types"
import { handleRouteError } from "@/server/api-route-helpers"
import {
  getSupabaseClientAndUserId,
  type TypedSupabaseClient,
} from "@/server/supabase-auth"
import * as currentUserService from "@/server/current-user-service"

type MeSuccessResponse = CurrentUserDto
type MeErrorResponse = ErrorResponseDto

/**
 * GET /api/me
 *
 * Returns the authenticated user's profile and derived application settings.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<MeSuccessResponse | MeErrorResponse>> {
  try {
    const {
      client,
      userId,
    }: { client: TypedSupabaseClient; userId: CurrentUserDto["id"] } =
      await getSupabaseClientAndUserId(request, {
        routeId: "/api/me",
      })

    const dto = await currentUserService.getCurrentUser(client, userId)

    return NextResponse.json<MeSuccessResponse>(dto, { status: 200 })
  } catch (error) {
    return handleRouteError<MeSuccessResponse, MeErrorResponse>(
      error,
      "/api/me",
    )
  }
}



