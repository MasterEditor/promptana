'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import type {
  CatalogId,
  CatalogListResponseDto,
  ErrorResponseDto,
  SearchPromptsResponseDto,
  TagId,
  TagListResponseDto,
} from "@/types"

import type {
  SearchFiltersOptionsVm,
  SearchFiltersVm,
  SearchResultItemVm,
  SearchSortOption,
  SearchViewState,
} from "./view-types"
import { mapSearchResultDtoToVm } from "./view-types"

/**
 * Build query string for API call from filters
 */
function buildApiQueryFromFilters(filters: SearchFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.q.trim().length > 0) {
    params.set("q", filters.q.trim())
  }

  if (filters.tagIds.length > 0) {
    params.set("tagIds", filters.tagIds.join(","))
  }

  if (filters.catalogId) {
    params.set("catalogId", filters.catalogId)
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (filters.sort !== "relevance") {
    params.set("sort", filters.sort)
  }

  return params.toString()
}

/**
 * Build URL query string for browser URL (includes all params for bookmarking)
 */
function buildUrlQueryFromFilters(filters: SearchFiltersVm): string {
  const params = new URLSearchParams()

  // Always include q if non-empty
  if (filters.q.trim().length > 0) {
    params.set("q", filters.q.trim())
  }

  if (filters.tagIds.length > 0) {
    params.set("tagIds", filters.tagIds.join(","))
  }

  if (filters.catalogId) {
    params.set("catalogId", filters.catalogId)
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (filters.sort !== "relevance") {
    params.set("sort", filters.sort)
  }

  return params.toString()
}

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

/**
 * Parse filters from URL search params
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
  defaults: { pageSize: number },
): SearchFiltersVm {
  const q = searchParams.get("q") ?? ""
  const tagIdsRaw = searchParams.get("tagIds") ?? ""
  const tagIds = tagIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as TagId[]
  const catalogIdRaw = searchParams.get("catalogId")
  const catalogId = catalogIdRaw && catalogIdRaw.trim().length > 0
    ? (catalogIdRaw.trim() as CatalogId)
    : null
  const sortRaw = searchParams.get("sort")
  const allowedSorts: SearchSortOption[] = ["relevance", "updatedAtDesc"]
  const sort = allowedSorts.includes(sortRaw as SearchSortOption)
    ? (sortRaw as SearchSortOption)
    : "relevance"
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10)
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSizeRaw = parseInt(
    searchParams.get("pageSize") ?? String(defaults.pageSize),
    10,
  )
  const pageSize = Number.isNaN(pageSizeRaw) || pageSizeRaw < 1 || pageSizeRaw > 50
    ? defaults.pageSize
    : pageSizeRaw

  return { q, tagIds, catalogId, sort, page, pageSize }
}

/**
 * Hook for managing search filter state with URL synchronization.
 * Updates URL search params when filters change.
 * Resets page to 1 when query, tags, catalog, or sort changes.
 * Also syncs state when URL changes externally (e.g. from global search).
 */
export function useSearchFilters(initialFilters: SearchFiltersVm) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<SearchFiltersVm>(initialFilters)

  // Sync filters from URL when searchParams change externally
  useEffect(() => {
    const parsed = parseFiltersFromSearchParams(searchParams, {
      pageSize: initialFilters.pageSize,
    })
    setFilters(parsed)
  }, [searchParams, initialFilters.pageSize])

  const updateFilters = useCallback(
    (partial: Partial<SearchFiltersVm>) => {
      setFilters((prev) => {
        const next: SearchFiltersVm = {
          ...prev,
          ...partial,
        }

        // Reset page when search criteria changes
        const shouldResetPage =
          partial.q !== undefined ||
          partial.sort !== undefined ||
          partial.catalogId !== undefined ||
          partial.tagIds !== undefined

        if (shouldResetPage && partial.page === undefined) {
          next.page = 1
        }

        const query = buildUrlQueryFromFilters(next)
        const href = query.length > 0 ? `/search?${query}` : "/search"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: SearchFiltersVm = {
        ...prev,
        tagIds: [],
        catalogId: null,
        sort: "relevance",
        page: 1,
      }

      const query = buildUrlQueryFromFilters(next)
      const href = query.length > 0 ? `/search?${query}` : "/search"

      router.replace(href, { scroll: false })

      return next
    })
  }, [router])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

/**
 * Hook for debouncing a value.
 * Used for search query input to prevent excessive API calls.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for fetching search results when query is provided.
 * Only fetches when q is non-empty.
 * Uses AbortController for request cancellation.
 */
export function useSearchData(filters: SearchFiltersVm) {
  const [state, setState] = useState<SearchViewState>(() => ({
    items: [],
    page: filters.page,
    pageSize: filters.pageSize,
    total: 0,
    isLoading: false,
    isInitialLoad: true,
    error: null,
  }))
  const [reloadCounter, setReloadCounter] = useState(0)

  const shouldFetch = filters.q.trim().length > 0
  const queryString = useMemo(
    () => buildApiQueryFromFilters(filters),
    [filters],
  )

  useEffect(() => {
    if (!shouldFetch) {
      setState((prev) => ({
        ...prev,
        items: [],
        total: 0,
        isLoading: false,
        isInitialLoad: false,
        error: null,
      }))
      return
    }

    const abortController = new AbortController()

    async function load() {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))

      try {
        const response = await fetch(`/api/search/prompts?${queryString}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: abortController.signal,
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
              message: "Failed to search prompts.",
            },
          }

          if (!abortController.signal.aborted) {
            setState((prev) => ({
              ...prev,
              items: [],
              total: 0,
              page: filters.page,
              pageSize: filters.pageSize,
              isLoading: false,
              isInitialLoad: false,
              error,
            }))
          }

          return
        }

        const data = (await response.json()) as SearchPromptsResponseDto

        if (!abortController.signal.aborted) {
          const items: SearchResultItemVm[] = data.items.map((item) =>
            mapSearchResultDtoToVm(item),
          )

          setState({
            items,
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            isLoading: false,
            isInitialLoad: false,
            error: null,
          })
        }
      } catch (err) {
        if (abortController.signal.aborted) return

        const error = parseErrorResponse(err)

        setState((prev) => ({
          ...prev,
          items: [],
          total: 0,
          page: filters.page,
          pageSize: filters.pageSize,
          isLoading: false,
          isInitialLoad: false,
          error,
        }))
      }
    }

    void load()

    return () => {
      abortController.abort()
    }
  }, [shouldFetch, queryString, filters.page, filters.pageSize, reloadCounter])

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1)
  }, [])

  return { state, reload }
}

/**
 * Hook for fetching available tags and catalogs for filter dropdowns.
 * Fetches from /api/tags and /api/catalogs in parallel.
 */
export function useSearchFiltersOptions() {
  const [options, setOptions] = useState<SearchFiltersOptionsVm>({
    availableTags: [],
    availableCatalogs: [],
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<ErrorResponseDto | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [tagsResponse, catalogsResponse] = await Promise.all([
        fetch("/api/tags?page=1&pageSize=200", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
        fetch("/api/catalogs?page=1&pageSize=100", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
      ])

      if (!tagsResponse.ok || !catalogsResponse.ok) {
        let body: ErrorResponseDto | null = null

        try {
          body = (await (tagsResponse.ok
            ? catalogsResponse.json()
            : tagsResponse.json())) as ErrorResponseDto
        } catch {
          // ignore JSON parse failure
        }

        setOptions({
          availableTags: [],
          availableCatalogs: [],
        })

        setError(
          body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load filter options.",
            },
          },
        )

        return
      }

      const tagsJson = (await tagsResponse.json()) as TagListResponseDto
      const catalogsJson =
        (await catalogsResponse.json()) as CatalogListResponseDto

      setOptions({
        availableTags: tagsJson.items,
        availableCatalogs: catalogsJson.items,
      })
      setError(null)
    } catch (err) {
      setOptions({
        availableTags: [],
        availableCatalogs: [],
      })
      setError(parseErrorResponse(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    options,
    isLoading,
    error,
    refresh,
  }
}

