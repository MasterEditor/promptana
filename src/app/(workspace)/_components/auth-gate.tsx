'use client'

import type { ReactNode } from "react"

import { AuthProvider, useAuth } from "../_auth/auth-context"
import { AppShell } from "./app-shell"
import { SignInRequiredPanel } from "./sign-in-required-panel"

function AuthGateInner({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useAuth()

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </main>
    )
  }

  if (status === "unauthenticated") {
    return <SignInRequiredPanel errorMessage={error?.error.message} />
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-4 max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold tracking-tight">
            Unable to verify your session
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {error?.error.message ??
              "Something went wrong while checking your session. Please try again."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                void refresh()
              }}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                // Clear tokens and reload to show sign-in page
                if (typeof document !== "undefined") {
                  document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
                  document.cookie = "sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
                }
                if (typeof window !== "undefined") {
                  window.location.reload()
                }
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Sign in again
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Authenticated – render children inside the workspace AppShell layout.
  return <AppShell>{children}</AppShell>
}

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateInner>{children}</AuthGateInner>
    </AuthProvider>
  )
}


