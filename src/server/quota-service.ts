import type { UserId } from "@/types"

/**
 * Placeholder quota service for runs.
 *
 * In a future iteration this module will integrate with Redis to enforce:
 * - Per-user daily run quotas
 * - Per-user and per-IP rate limits
 *
 * For now these functions are no-ops so the API surface is in place without
 * introducing additional infrastructure dependencies.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkAndIncrementRunQuota(userId: UserId): Promise<void> {
  // TODO: Integrate Redis-based quota tracking.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkRunRateLimit(
  userId: UserId,
  ip: string | null,
): Promise<void> {
  // TODO: Integrate Redis-based per-user and per-IP rate limiting.
}


