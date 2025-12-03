import type { ErrorDetails } from "@/types"
import { ApiError } from "@/server/http-errors"

export const UUID_V4_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export function assertUuidPathParam(
  fieldName: string,
  rawValue: string,
): string {
  const fieldErrors: ErrorDetails["fieldErrors"] = {}

  if (!UUID_V4_REGEX.test(rawValue)) {
    fieldErrors[fieldName] = ["Must be a valid UUID string."]
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Path parameters are invalid.",
      details: { fieldErrors },
    })
  }

  return rawValue
}


