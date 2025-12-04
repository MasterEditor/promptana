'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import type { CurrentUserDto, ErrorResponseDto } from "@/types"

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated" | "error"

export interface AuthState {
  status: AuthStatus
  user: CurrentUserDto | null
  error: ErrorResponseDto | null
}

export interface AuthContextValue extends AuthState {
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchCurrentUser(): Promise<{
  status: AuthStatus
  user: CurrentUserDto | null
  error: ErrorResponseDto | null
}> {
  try {
    const response = await fetch("/api/me", {
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

    // 401/403 are treated as unauthenticated, everything else as error.
    if (response.status === 401 || response.status === 403) {
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
    status: "unknown",
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


