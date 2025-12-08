import Link from "next/link"

import type { CatalogId, TagId } from "@/types"

import type { PromptListFiltersVm, PromptListSort } from "./view-types"
import PromptsView from "./PromptsView"

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

function parseSortParam(value: string | string[] | undefined): PromptListSort {
  const asString = typeof value === "string" ? value : undefined

  const allowed: PromptListSort[] = [
    "updatedAtDesc",
    "createdAtDesc",
    "titleAsc",
    "lastRunDesc",
    "relevance",
  ]

  if (allowed.includes(asString as PromptListSort)) {
    return asString as PromptListSort
  }

  return "updatedAtDesc"
}

function parseTagIdsParam(value: string | string[] | undefined): TagId[] {
  if (typeof value !== "string") return []

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0) as TagId[]
}

function parseCatalogIdParam(
  value: string | string[] | undefined,
): CatalogId | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed as CatalogId
}

function clampPageSize(value: number): number {
  if (value < MIN_PAGE_SIZE) return MIN_PAGE_SIZE
  if (value > MAX_PAGE_SIZE) return MAX_PAGE_SIZE
  return value
}

interface PromptsPageProps {
  searchParams?: SearchParams
}

export default function PromptsPage({ searchParams }: PromptsPageProps) {
  const params = searchParams ?? {}

  const page = parseNumberParam(params.page, 1)
  const pageSize = clampPageSize(
    parseNumberParam(params.pageSize, DEFAULT_PAGE_SIZE),
  )

  const sort = parseSortParam(params.sort)
  const search =
    typeof params.search === "string" ? params.search.trim() : ""

  const tagIds = parseTagIdsParam(params.tagIds)
  const catalogId = parseCatalogIdParam(params.catalogId)

  const initialFilters: PromptListFiltersVm = {
    search,
    tagIds,
    catalogId,
    sort,
    page,
    pageSize,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage your prompts. Create, edit, run, and improve your AI prompts.
          </p>
        </div>
        <Link
          href="/prompts/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-zinc-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Prompt
        </Link>
      </div>
      <PromptsView initialFilters={initialFilters} />
    </div>
  )
}

