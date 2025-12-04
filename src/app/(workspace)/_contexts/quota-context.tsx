'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { ReactNode } from "react"

import type { ErrorResponseDto, QuotaDto } from "@/types"
import type { QuotaContextValue, QuotaSummaryVm } from "../view-types"

const QuotaContext = createContext<QuotaContextValue | undefined>(undefined)

function deriveSummary(quota: QuotaDto | null): QuotaSummaryVm | null {
  if (!quota) return null

  const {
    limits: { runPerDay, improvePerDay },
    usage: { runCount, improveCount },
    remaining,
    costCap,
  } = quota

  const runUsagePercent =
    runPerDay > 0 ? Math.min(100, (runCount / runPerDay) * 100) : 0
  const improveUsagePercent =
    improvePerDay > 0 ? Math.min(100, (improveCount / improvePerDay) * 100) : 0

  return {
    remainingRun: remaining.run,
    remainingImprove: remaining.improve,
    runUsagePercent,
    improveUsagePercent,
    isDailyRunCapReached: remaining.run <= 0,
    isDailyImproveCapReached: remaining.improve <= 0,
    isAnyCostCapBlocked:
      costCap.daily.blocked === true || costCap.monthly.blocked === true,
  }
}

export function QuotaProvider({ children }: { children: ReactNode }) {
  const [quota, setQuota] = useState<QuotaDto | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<ErrorResponseDto | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/quota", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        let body: ErrorResponseDto | null

        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          body = {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load quota.",
            },
          }
        }

        setQuota(null)
        setError(body)
        return
      }

      const data = (await response.json()) as QuotaDto
      setQuota(data)
      setError(null)
    } catch {
      setQuota(null)
      setError({
        error: {
          code: "INTERNAL_ERROR",
          message: "Network error while loading quota.",
        },
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value: QuotaContextValue = {
    quota,
    summary: deriveSummary(quota),
    isLoading,
    error,
    refresh,
  }

  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>
}

export function useQuotaContext(): QuotaContextValue {
  const context = useContext(QuotaContext)
  if (!context) {
    throw new Error("useQuotaContext must be used within a QuotaProvider")
  }
  return context
}


