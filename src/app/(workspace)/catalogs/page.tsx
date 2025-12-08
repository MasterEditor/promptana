import type { CatalogsListFiltersVm } from "./view-types"
import CatalogsView from "./CatalogsView"

const DEFAULT_PAGE_SIZE = 20
const MIN_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 100

type SearchParams = Record<string, string | string[] | undefined>

function parseNumberParam(
  value: string | string[] | undefined,
  fallback: number,
): number {
  if (typeof value !== "string") return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

function clampPageSize(value: number): number {
  if (value < MIN_PAGE_SIZE) return MIN_PAGE_SIZE
  if (value > MAX_PAGE_SIZE) return MAX_PAGE_SIZE
  return value
}

interface CatalogsPageProps {
  searchParams?: SearchParams
}

export default function CatalogsPage({ searchParams }: CatalogsPageProps) {
  const params = searchParams ?? {}

  const page = parseNumberParam(params.page, 1)
  const pageSize = clampPageSize(
    parseNumberParam(params.pageSize, DEFAULT_PAGE_SIZE),
  )

  const search =
    typeof params.search === "string" ? params.search.trim() : ""

  const initialFilters: CatalogsListFiltersVm = {
    search,
    page,
    pageSize,
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Catalogs</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organize your prompts into catalogs for easier management.
        </p>
      </div>
      <CatalogsView initialFilters={initialFilters} />
    </div>
  )
}

