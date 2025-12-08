'use client'

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { ErrorResponseDto, PromptId } from "@/types"

import { useGlobalMessagesContext } from "../_contexts/global-messages-context"
import { useOfflineContext } from "../_contexts/offline-context"
import type { PromptListItemVm } from "./view-types"

function parseErrorResponse(error: unknown): ErrorResponseDto {
  if (typeof error === "object" && error && "error" in error) {
    return error as ErrorResponseDto
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
    },
  }
}

interface UsePromptRowActionsOptions {
  onDeleted?: () => void
}

export function usePromptRowActions(options: UsePromptRowActionsOptions = {}) {
  const router = useRouter()
  const { isOffline } = useOfflineContext()
  const { addErrorFromApi, addMessage } = useGlobalMessagesContext()
  const [deletingPromptId, setDeletingPromptId] = useState<PromptId | null>(null)

  const canRun = useMemo(() => {
    return !isOffline
  }, [isOffline])

  const canDelete = useMemo(() => {
    return !isOffline
  }, [isOffline])

  const runPrompt = useCallback(
    (prompt: PromptListItemVm) => {
      if (!canRun) return
      router.push(`/prompts/${prompt.id}?action=run`)
    },
    [canRun, router],
  )

  const openPrompt = useCallback(
    (prompt: PromptListItemVm) => {
      router.push(`/prompts/${prompt.id}`)
    },
    [router],
  )

  const deletePrompt = useCallback(
    async (prompt: PromptListItemVm) => {
      if (!canDelete) return

      setDeletingPromptId(prompt.id)

      try {
        const response = await fetch(`/api/prompts/${prompt.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ confirm: true }),
        })

        if (!response.ok) {
          let body: ErrorResponseDto | null = null

          try {
            body = (await response.json()) as ErrorResponseDto
          } catch {
            // ignore JSON parse failure; fall back to generic error
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to delete prompt.",
            },
          }

          addErrorFromApi(error)
          return
        }

        addMessage({
          type: "success",
          title: "Prompt deleted",
          message: "The prompt was deleted successfully.",
        })

        options.onDeleted?.()
      } catch (err) {
        const error = parseErrorResponse(err)
        addErrorFromApi(error)
      } finally {
        setDeletingPromptId(null)
      }
    },
    [addErrorFromApi, addMessage, canDelete, options, setDeletingPromptId],
  )

  return {
    canRun,
    canDelete,
    deletingPromptId,
    runPrompt,
    openPrompt,
    deletePrompt,
  }
}
