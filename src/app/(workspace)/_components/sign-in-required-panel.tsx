'use client'

import { useState } from "react"

import { Button } from "@/components/ui/button"

interface SignInRequiredPanelProps {
  errorMessage?: string
}

export function SignInRequiredPanel({
  errorMessage,
}: SignInRequiredPanelProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validateEmail(value: string): string | null {
    if (!value.trim()) {
      return "Email is required."
    }

    const basicEmailPattern = /\S+@\S+\.\S+/

    if (!basicEmailPattern.test(value)) {
      return "Please enter a valid email address."
    }

    return null
  }

  function validatePassword(value: string): string | null {
    if (!value.trim()) {
      return "Password is required."
    }

    if (value.length < 6) {
      return "Password must be at least 6 characters."
    }

    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = validateEmail(email)
    const nextPasswordError = validatePassword(password)

    if (nextEmailError || nextPasswordError) {
      setEmailError(nextEmailError)
      setPasswordError(nextPasswordError)
      return
    }

    setEmailError(null)
    setPasswordError(null)
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        try {
          const errorBody = (await response.json()) as {
            error?: { message?: string }
          }

          setSubmitError(
            errorBody.error?.message ??
              "Sign-in failed. Please check your credentials and try again.",
          )
        } catch {
          setSubmitError(
            "Sign-in failed. Please check your credentials and try again.",
          )
        }

        setIsSubmitting(false)
        return
      }

      const body = (await response.json()) as {
        accessToken: string
        refreshToken: string | null
      }

      if (typeof document !== "undefined") {
        document.cookie = `sb-access-token=${body.accessToken}; path=/; samesite=lax`

        if (body.refreshToken) {
          document.cookie = `sb-refresh-token=${body.refreshToken}; path=/; samesite=lax`
        }
      }

      if (typeof window !== "undefined") {
        window.location.href = "/prompts"
      }
    } catch {
      setSubmitError(
        "We couldn’t sign you in due to a network error. Please try again.",
      )
      setIsSubmitting(false)
    }
  }

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

        <div
          role="status"
          aria-live="polite"
          className="mb-4 min-h-[1.25rem] text-sm"
        >
          {errorMessage ? (
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
          ) : submitError ? (
            <p className="text-red-600 dark:text-red-400">{submitError}</p>
          ) : null}
        </div>

        <form className="space-y-4 text-left" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (emailError) {
                  setEmailError(null)
                }
              }}
              aria-invalid={emailError ? "true" : "false"}
              aria-describedby={emailError ? "email-error" : undefined}
              disabled={isSubmitting}
            />
            {emailError ? (
              <p
                id="email-error"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {emailError}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (passwordError) {
                  setPasswordError(null)
                }
              }}
              aria-invalid={passwordError ? "true" : "false"}
              aria-describedby={passwordError ? "password-error" : undefined}
              disabled={isSubmitting}
            />
            {passwordError ? (
              <p
                id="password-error"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {passwordError}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            className="mt-2 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  )
}

