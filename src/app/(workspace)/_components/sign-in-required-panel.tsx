'use client'

import { useState } from "react"

import { Button } from "@/components/ui/button"

type AuthMode = "signin" | "signup"

interface SignInRequiredPanelProps {
  errorMessage?: string
}

export function SignInRequiredPanel({
  errorMessage,
}: SignInRequiredPanelProps) {
  const [mode, setMode] = useState<AuthMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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

  function validateConfirmPassword(value: string, originalPassword: string): string | null {
    if (!value.trim()) {
      return "Please confirm your password."
    }

    if (value !== originalPassword) {
      return "Passwords do not match."
    }

    return null
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode)
    setEmailError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)
    setSubmitError(null)
    setSuccessMessage(null)
    setPassword("")
    setConfirmPassword("")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = validateEmail(email)
    const nextPasswordError = validatePassword(password)
    const nextConfirmPasswordError = mode === "signup" 
      ? validateConfirmPassword(confirmPassword, password)
      : null

    if (nextEmailError || nextPasswordError || nextConfirmPasswordError) {
      setEmailError(nextEmailError)
      setPasswordError(nextPasswordError)
      setConfirmPasswordError(nextConfirmPasswordError)
      return
    }

    setEmailError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup"
    const errorMessageDefault = mode === "signin"
      ? "Sign-in failed. Please check your credentials and try again."
      : "Sign-up failed. Please try again."

    try {
      const response = await fetch(endpoint, {
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

          setSubmitError(errorBody.error?.message ?? errorMessageDefault)
        } catch {
          setSubmitError(errorMessageDefault)
        }

        setIsSubmitting(false)
        return
      }

      const body = (await response.json()) as {
        accessToken: string
        refreshToken: string | null
      }

      // If accessToken is empty, it means email confirmation is required
      if (!body.accessToken) {
        setSuccessMessage(
          "Account created! Please check your email to confirm your account, then sign in."
        )
        setIsSubmitting(false)
        setMode("signin")
        setPassword("")
        setConfirmPassword("")
        return
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
        mode === "signin"
          ? "We couldn't sign you in due to a network error. Please try again."
          : "We couldn't create your account due to a network error. Please try again."
      )
      setIsSubmitting(false)
    }
  }

  const isSignIn = mode === "signin"

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {isSignIn ? "Sign in to Promptana" : "Create an account"}
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          {isSignIn
            ? "Store, run, and improve your prompts safely. Please sign in to continue."
            : "Create your account to start managing your prompts."}
        </p>

        <div
          role="status"
          aria-live="polite"
          className="mb-4 min-h-[1.25rem] text-sm"
        >
          {submitError ? (
            <p className="text-red-600 dark:text-red-400">{submitError}</p>
          ) : successMessage ? (
            <p className="text-green-600 dark:text-green-400">{successMessage}</p>
          ) : errorMessage ? (
            <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
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
              autoComplete={isSignIn ? "current-password" : "new-password"}
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

          {!isSignIn && (
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  if (confirmPasswordError) {
                    setConfirmPasswordError(null)
                  }
                }}
                aria-invalid={confirmPasswordError ? "true" : "false"}
                aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                disabled={isSubmitting}
              />
              {confirmPasswordError ? (
                <p
                  id="confirm-password-error"
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                >
                  {confirmPasswordError}
                </p>
              ) : null}
            </div>
          )}

          <Button
            type="submit"
            className="mt-2 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isSignIn ? "Signing in…" : "Creating account…")
              : (isSignIn ? "Sign in" : "Create account")}
          </Button>
        </form>

        <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          {isSignIn ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
                onClick={() => switchMode("signup")}
                disabled={isSubmitting}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
                onClick={() => switchMode("signin")}
                disabled={isSubmitting}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
