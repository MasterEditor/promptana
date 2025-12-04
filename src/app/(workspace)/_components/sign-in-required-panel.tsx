'use client'

import { useState } from "react"

import { Button } from "@/components/ui/button"

interface SignInRequiredPanelProps {
  errorMessage?: string
}

export function SignInRequiredPanel({
  errorMessage,
}: SignInRequiredPanelProps) {
  const [isSigningIn, setIsSigningIn] = useState<"google" | "email" | null>(
    null,
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="mx-4 max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sign in to Promptana
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Store, run, and improve your prompts safely. Please sign in to
          continue.
        </p>

        {errorMessage ? (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={isSigningIn !== null}
            onClick={() => {
              // TODO: Wire to Supabase Google sign-in or auth route.
              setIsSigningIn("google")
            }}
          >
            {isSigningIn === "google" ? "Signing in…" : "Sign in with Google"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full border border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            disabled={isSigningIn !== null}
            onClick={() => {
              // TODO: Navigate to email sign-in flow.
              setIsSigningIn("email")
            }}
          >
            {isSigningIn === "email" ? "Signing in…" : "Sign in with Email"}
          </Button>
        </div>
      </div>
    </main>
  )
}


