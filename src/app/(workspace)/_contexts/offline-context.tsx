'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import type { ReactNode } from "react"

import type { OfflineContextValue } from "../view-types"

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null)

  const updateStatus = useCallback((offline: boolean) => {
    setIsOffline(offline)
    setLastChangedAt(new Date())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    updateStatus(!window.navigator.onLine)

    const handleOnline = () => updateStatus(false)
    const handleOffline = () => updateStatus(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [updateStatus])

  const value: OfflineContextValue = {
    isOffline,
    lastChangedAt,
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext(): OfflineContextValue {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error("useOfflineContext must be used within an OfflineProvider")
  }
  return context
}


