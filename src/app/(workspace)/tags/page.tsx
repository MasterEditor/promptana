import type { TagsListFiltersVm } from "./view-types"
import TagsView from "./TagsView"

const DEFAULT_PAGE_SIZE = 50
const MIN_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 200

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

interface TagsPageProps {
  searchParams?: Promise<SearchParams>
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const params = (await searchParams) ?? {}

  const page = parseNumberParam(params.page, 1)
  const pageSize = clampPageSize(
    parseNumberParam(params.pageSize, DEFAULT_PAGE_SIZE),
  )

  const search =
    typeof params.search === "string" ? params.search.trim() : ""

  const initialFilters: TagsListFiltersVm = {
    search,
    page,
    pageSize,
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organize your prompts with tags for easier filtering and discovery.
        </p>
      </div>
      <TagsView initialFilters={initialFilters} />
    </div>
  )
}

