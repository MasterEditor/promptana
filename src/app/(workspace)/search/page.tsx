import type { CatalogId, TagId } from "@/types"

import type { SearchFiltersVm, SearchSortOption } from "./view-types"
import SearchView from "./SearchView"

const DEFAULT_PAGE_SIZE = 20
const MIN_PAGE_SIZE = 1
const MAX_PAGE_SIZE = 50

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Parse a string or string[] to a single string, returning fallback if not a string.
 */
function parseStringParam(
  value: string | string[] | undefined,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback
  return value
}

/**
 * Parse a numeric parameter from search params.
 */
function parseNumberParam(
  value: string | string[] | undefined,
  fallback: number,
): number {
  if (typeof value !== "string") return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

/**
 * Parse and validate the sort parameter.
 */
function parseSortParam(value: string | string[] | undefined): SearchSortOption {
  const asString = typeof value === "string" ? value : undefined

  const allowed: SearchSortOption[] = ["relevance", "updatedAtDesc"]

  if (allowed.includes(asString as SearchSortOption)) {
    return asString as SearchSortOption
  }

  return "relevance"
}

/**
 * Parse comma-separated tag IDs from search params.
 */
function parseTagIdsParam(value: string | string[] | undefined): TagId[] {
  if (typeof value !== "string") return []

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0) as TagId[]
}

/**
 * Parse catalog ID from search params.
 */
function parseCatalogIdParam(
  value: string | string[] | undefined,
): CatalogId | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed as CatalogId
}

/**
 * Clamp page size to valid range.
 */
function clampPageSize(value: number): number {
  if (value < MIN_PAGE_SIZE) return MIN_PAGE_SIZE
  if (value > MAX_PAGE_SIZE) return MAX_PAGE_SIZE
  return value
}

interface SearchPageProps {
  searchParams?: Promise<SearchParams>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {}

  const q = parseStringParam(params.q, "")
  const tagIds = parseTagIdsParam(params.tagIds)
  const catalogId = parseCatalogIdParam(params.catalogId)
  const sort = parseSortParam(params.sort)
  const page = parseNumberParam(params.page, 1)
  const pageSize = clampPageSize(parseNumberParam(params.pageSize, DEFAULT_PAGE_SIZE))

  const initialFilters: SearchFiltersVm = {
    q,
    tagIds,
    catalogId,
    sort,
    page,
    pageSize,
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Search across your prompts by title, content, and catalog names.
        </p>
      </div>
      <SearchView initialFilters={initialFilters} />
    </div>
  )
}

