'use client'

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

import type { ErrorResponseDto } from "@/types"
import type {
  GlobalMessage,
  GlobalMessagesContextValue,
} from "../view-types"

const GlobalMessagesContext = createContext<
  GlobalMessagesContextValue | undefined
>(undefined)

let idCounter = 0

function createId() {
  idCounter += 1
  return `msg_${idCounter}`
}

export function GlobalMessagesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [messages, setMessages] = useState<GlobalMessage[]>([])

  const addMessage = useCallback(
    (message: Omit<GlobalMessage, "id">) => {
      const id = createId()
      setMessages((prev) => [...prev, { ...message, id }])
    },
    [setMessages],
  )

  const removeMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    },
    [setMessages],
  )

  const addErrorFromApi = useCallback(
    (error: ErrorResponseDto) => {
      const code = error.error.code

      if (code === "RATE_LIMITED") {
        addMessage({
          type: "warning",
          code,
          title: "Rate limited",
          message:
            "You’re sending requests too quickly. Please wait a moment and try again.",
        })
      } else if (code === "QUOTA_EXCEEDED") {
        addMessage({
          type: "warning",
          code,
          title: "Quota exceeded",
          message: "You’ve reached today’s quota for this action.",
        })
      } else if (code === "OPENROUTER_ERROR") {
        addMessage({
          type: "error",
          code,
          title: "AI provider error",
          message:
            "There was an error contacting the AI provider. Please try again.",
        })
      } else {
        addMessage({
          type: "error",
          code,
          title: "Something went wrong",
          message: error.error.message,
        })
      }
    },
    [addMessage],
  )

  const value: GlobalMessagesContextValue = useMemo(
    () => ({
      messages,
      addMessage,
      addErrorFromApi,
      removeMessage,
    }),
    [messages, addMessage, addErrorFromApi, removeMessage],
  )

  return (
    <GlobalMessagesContext.Provider value={value}>
      {children}
    </GlobalMessagesContext.Provider>
  )
}

export function useGlobalMessagesContext(): GlobalMessagesContextValue {
  const context = useContext(GlobalMessagesContext)
  if (!context) {
    throw new Error(
      "useGlobalMessagesContext must be used within a GlobalMessagesProvider",
    )
  }
  return context
}


