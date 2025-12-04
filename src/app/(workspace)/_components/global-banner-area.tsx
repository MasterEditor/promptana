'use client'

import { useGlobalMessagesContext } from "../_contexts/global-messages-context"
import { useOfflineContext } from "../_contexts/offline-context"

export function GlobalBannerArea() {
  const { isOffline } = useOfflineContext()
  const { messages, removeMessage } = useGlobalMessagesContext()

  if (!isOffline && messages.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-6">
      {isOffline ? (
        <div className="flex items-center justify-between rounded-md bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <span>You’re offline. Some actions are disabled until you’re back online.</span>
        </div>
      ) : null}

      {messages.map((message) => (
        <div
          key={message.id}
          className="flex items-start justify-between rounded-md bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <div>
            {message.title ? (
              <p className="text-xs font-semibold uppercase tracking-wide">
                {message.title}
              </p>
            ) : null}
            <p className="text-sm">{message.message}</p>
          </div>
          <button
            type="button"
            onClick={() => removeMessage(message.id)}
            className="ml-3 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}


