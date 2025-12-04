'use client'

import { useEffect, useMemo, useState } from "react"

import type { CatalogListResponseDto, CatalogDto, ErrorResponseDto } from "@/types"
import type { CatalogNavItemVm } from "../view-types"
import { usePathname, useSearchParams } from "next/navigation"

interface UseCatalogNavResult {
  items: CatalogNavItemVm[]
  isLoading: boolean
  error: ErrorResponseDto | null
}

export function useCatalogNav(): UseCatalogNavResult {
  const [catalogs, setCatalogs] = useState<CatalogDto[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<ErrorResponseDto | null>(null)

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeCatalogId = searchParams.get("catalogId")

  useEffect(() => {
    let isCancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/catalogs?page=1&pageSize=100", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })

        if (!response.ok) {
          let errorBody: ErrorResponseDto | null

          try {
            errorBody = (await response.json()) as ErrorResponseDto
          } catch {
            errorBody = {
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to load catalogs.",
              },
            }
          }

          if (!isCancelled) {
            setError(errorBody)
            setCatalogs([])
          }

          return
        }

        const data = (await response.json()) as CatalogListResponseDto

        if (!isCancelled) {
          setCatalogs(data.items)
          setError(null)
        }
      } catch {
        if (!isCancelled) {
          setError({
            error: {
              code: "INTERNAL_ERROR",
              message: "Network error while loading catalogs.",
            },
          })
          setCatalogs([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [])

  const items = useMemo<CatalogNavItemVm[]>(() => {
    return catalogs.map((catalog) => {
      const href = `/prompts?catalogId=${encodeURIComponent(catalog.id)}`

      const isActive =
        pathname.startsWith("/prompts") && activeCatalogId === String(catalog.id)

      return {
        id: catalog.id,
        name: catalog.name,
        href,
        isActive,
      }
    })
  }, [catalogs, pathname, activeCatalogId])

  return {
    items,
    isLoading,
    error,
  }
}


