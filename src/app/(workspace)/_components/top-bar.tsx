'use client'

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useAuthContext } from "../_auth/auth-context"
import { useOfflineContext } from "../_contexts/offline-context"
import { useQuotaContext } from "../_contexts/quota-context"

export function TopBar() {
  const { user } = useAuthContext()
  const { summary } = useQuotaContext()
  const { isOffline } = useOfflineContext()

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialQuery = searchParams.get("q") ?? ""
  const [query, setQuery] = useState(initialQuery)
  const [error, setError] = useState<string | null>(null)

  const isOnSearchPage = pathname === "/search"

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (isOffline) {
      setError("Search is unavailable while offline.")
      return
    }

    if (query.length > 500) {
      setError("Search query must be 500 characters or fewer.")
      return
    }

    setError(null)

    const next = new URLSearchParams(searchParams.toString())
    if (query) {
      next.set("q", query)
    } else {
      next.delete("q")
    }

    router.push(`/search?${next.toString()}`)
  }

  const quotaLabel =
    summary != null
      ? `Runs left: ${summary.remainingRun}, Improves left: ${summary.remainingImprove}`
      : "Quota: unavailable"

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 text-sm dark:border-zinc-800 dark:bg-zinc-950 md:px-6">
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={() => router.push("/prompts")}
      >
        <span className="text-base font-semibold tracking-tight">Promptana</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-4 hidden max-w-md flex-1 items-center gap-2 md:flex"
      >
        <input
          type="text"
          placeholder="Search prompts…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (error) {
              setError(null)
            }
          }}
          className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          disabled={isOffline}
        />
        <Button
          type="submit"
          variant="ghost"
          className="h-8 px-3 text-xs"
          disabled={isOffline || query.length > 500}
        >
          {isOnSearchPage ? "Update" : "Search"}
        </Button>
        {error ? (
          <p className="ml-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </form>

      <div className="flex items-center gap-4">
        <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 md:inline">
          {quotaLabel}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-zinc-600 dark:text-zinc-300 sm:inline">
            {user.email}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => router.push("/settings")}
          >
            Settings
          </Button>
        </div>
      </div>
    </header>
  )
}


