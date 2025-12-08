'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import type { CurrentUserDto, ErrorResponseDto } from "@/types"

export type AuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "error"

export interface AuthState {
  status: AuthStatus
  user: CurrentUserDto | null
  error: ErrorResponseDto | null
}

export interface AuthContextValue extends AuthState {
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Attempt to refresh the session using the refresh token.
 * Returns true if refresh succeeded, false otherwise.
 */
async function tryRefreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    })

    if (response.ok) {
      const body = (await response.json()) as {
        accessToken: string
        refreshToken: string | null
      }

      // Update cookies with new tokens (server also sets them, but ensure client-side)
      if (typeof document !== "undefined") {
        document.cookie = `sb-access-token=${body.accessToken}; path=/; samesite=lax`

        if (body.refreshToken) {
          document.cookie = `sb-refresh-token=${body.refreshToken}; path=/; samesite=lax`
        }
      }

      return true
    }

    return false
  } catch {
    return false
  }
}

async function fetchCurrentUser(): Promise<{
  status: AuthStatus
  user: CurrentUserDto | null
  error: ErrorResponseDto | null
}> {
  try {
    let response = await fetch("/api/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    })

    if (response.ok) {
      const user = (await response.json()) as CurrentUserDto
      return {
        status: "authenticated",
        user,
        error: null,
      }
    }

    // If we get 401, try to refresh the token and retry once
    if (response.status === 401) {
      const refreshed = await tryRefreshSession()

      if (refreshed) {
        // Retry the /api/me call with new token
        response = await fetch("/api/me", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        })

        if (response.ok) {
          const user = (await response.json()) as CurrentUserDto
          return {
            status: "authenticated",
            user,
            error: null,
          }
        }
      }

      // Refresh failed or retry failed - user needs to sign in
      // Don't show an error message for simple unauthenticated state
      return {
        status: "unauthenticated",
        user: null,
        error: null,
      }
    }

    // 403 is treated as unauthenticated
    if (response.status === 403) {
      let error: ErrorResponseDto | null = null

      try {
        error = (await response.json()) as ErrorResponseDto
      } catch {
        error = null
      }

      return {
        status: "unauthenticated",
        user: null,
        error,
      }
    }

    // Other errors (500, etc.) - show error state
    let error: ErrorResponseDto | null

    try {
      error = (await response.json()) as ErrorResponseDto
    } catch {
      error = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to verify your session.",
        },
      }
    }

    return {
      status: "error",
      user: null,
      error,
    }
  } catch {
    const error: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Network error while verifying your session.",
      },
    }

    return {
      status: "error",
      user: null,
      error,
    }
  }
}

export function useAuth(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    status: "checking",
    user: null,
    error: null,
  })

  const refresh = useCallback(async () => {
    const result = await fetchCurrentUser()
    setState({
      status: result.status,
      user: result.user,
      error: result.error,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { status, user, error, refresh } = useAuth()

  const value: AuthContextValue = {
    status,
    user,
    error,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }

  return context
}


