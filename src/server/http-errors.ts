import type { ErrorCode, ErrorDetails, ErrorResponseDto } from "@/types"

interface ApiErrorOptions {
  status: number
  code: ErrorCode
  message: string
  details?: ErrorDetails
}

/**
 * Standardized error for server-side API handlers.
 * Route handlers should catch this and convert it to an ErrorResponseDto.
 */
export class ApiError extends Error {
  public readonly status: number
  public readonly code: ErrorCode
  public readonly details?: ErrorDetails

  constructor(options: ApiErrorOptions) {
    super(options.message)
    this.name = "ApiError"
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

/**
 * Helper to convert an ApiError into a standard ErrorResponseDto.
 */
export function apiErrorToResponse(
  error: ApiError,
): { status: number; body: ErrorResponseDto } {
  const body: ErrorResponseDto = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  }

  return { status: error.status, body }
}


