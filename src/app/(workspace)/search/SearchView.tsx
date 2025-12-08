'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { PromptId, TagId } from "@/types"

import {
  useDebouncedValue,
  useSearchData,
  useSearchFilters,
  useSearchFiltersOptions,
} from "./hooks"
import type {
  SearchFiltersOptionsVm,
  SearchFiltersVm,
  SearchResultItemVm,
  SearchSortOption,
} from "./view-types"

interface SearchViewProps {
  initialFilters: SearchFiltersVm
}

export default function SearchView({ initialFilters }: SearchViewProps) {
  const router = useRouter()
  const { filters, updateFilters, resetFilters } = useSearchFilters(initialFilters)

  // Local state for the input field (before debounce)
  const [queryInput, setQueryInput] = useState(filters.q)
  const debouncedQuery = useDebouncedValue(queryInput, 300)

  // Track if user is typing (to prevent overwriting input from URL sync)
  const isTypingRef = useRef(false)

  // Sync query input when filters.q changes externally (e.g. URL change)
  useEffect(() => {
    if (!isTypingRef.current) {
      setQueryInput(filters.q)
    }
  }, [filters.q])

  // Update filters when debounced query changes
  // Using a callback to check if it actually changed
  const handleQueryChange = useCallback(
    (value: string) => {
      isTypingRef.current = true
      setQueryInput(value)
      // Reset typing flag after debounce period
      setTimeout(() => {
        isTypingRef.current = false
      }, 350)
    },
    [],
  )

  // Submit search immediately (on Enter)
  const handleSubmitSearch = useCallback(() => {
    isTypingRef.current = false
    if (queryInput.trim() !== filters.q) {
      updateFilters({ q: queryInput.trim() })
    }
  }, [queryInput, filters.q, updateFilters])

  // Sync debounced value to filters
  if (debouncedQuery !== filters.q && debouncedQuery === queryInput) {
    updateFilters({ q: debouncedQuery })
  }

  const { state, reload } = useSearchData(filters)
  const {
    options,
    isLoading: isOptionsLoading,
    error: optionsError,
    refresh: refreshOptions,
  } = useSearchFiltersOptions()

  const handleOpenPrompt = useCallback(
    (promptId: PromptId) => {
      router.push(`/prompts/${promptId}`)
    },
    [router],
  )

  const hasQuery = filters.q.trim().length > 0
  const hasResults = state.total > 0
  const hasFilters =
    filters.tagIds.length > 0 ||
    filters.catalogId !== null ||
    filters.sort !== "relevance"

  return (
    <section className="space-y-4">
      <SearchFiltersBar
        filters={filters}
        queryInput={queryInput}
        options={options}
        isOptionsLoading={isOptionsLoading}
        onQueryChange={handleQueryChange}
        onFiltersChange={updateFilters}
        onResetFilters={resetFilters}
        onSubmitSearch={handleSubmitSearch}
        optionsErrorMessage={optionsError?.error.message}
        onRetryLoadOptions={refreshOptions}
      />

      {state.error ? (
        <SearchErrorState
          errorMessage={state.error.error.message}
          onRetry={reload}
        />
      ) : null}

      {state.isLoading && state.isInitialLoad && hasQuery ? (
        <SearchLoadingSkeleton />
      ) : null}

      {!hasQuery && !state.isLoading ? (
        <SearchPromptState />
      ) : null}

      {hasQuery && !state.isLoading && !state.error && !hasResults ? (
        <SearchEmptyState
          query={filters.q}
          hasFilters={hasFilters}
          onResetFilters={resetFilters}
        />
      ) : null}

      {hasResults ? (
        <SearchResultsList
          results={state.items}
          onOpenPrompt={handleOpenPrompt}
          isLoading={state.isLoading}
        />
      ) : null}

      {hasResults ? (
        <SearchPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// SearchFiltersBar
// ---------------------------------------------------------------------------

interface SearchFiltersBarProps {
  filters: SearchFiltersVm
  queryInput: string
  options: SearchFiltersOptionsVm
  isOptionsLoading: boolean
  onQueryChange: (value: string) => void
  onFiltersChange: (partial: Partial<SearchFiltersVm>) => void
  onResetFilters: () => void
  onSubmitSearch: () => void
  optionsErrorMessage?: string
  onRetryLoadOptions: () => void
}

function SearchFiltersBar({
  filters,
  queryInput,
  options,
  isOptionsLoading,
  onQueryChange,
  onFiltersChange,
  onResetFilters,
  onSubmitSearch,
  optionsErrorMessage,
  onRetryLoadOptions,
}: SearchFiltersBarProps) {
  const hasActiveFilters =
    filters.tagIds.length > 0 ||
    filters.catalogId !== null ||
    filters.sort !== "relevance"

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <input
              type="search"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="Search prompts..."
              value={queryInput}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmitSearch()
                }
              }}
              maxLength={500}
              aria-label="Search query"
            />
            <svg
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"
              />
            </svg>
          </div>

          <TagMultiSelect
            selectedTagIds={filters.tagIds}
            availableTags={options.availableTags}
            onSelectionChange={(tagIds) => onFiltersChange({ tagIds })}
          />

          <select
            className="h-9 min-w-[8rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 md:w-40"
            value={filters.catalogId ?? ""}
            onChange={(event) => {
              const value = event.target.value
              onFiltersChange({ catalogId: value === "" ? null : value })
            }}
            aria-label="Filter by catalog"
          >
            <option value="">All catalogs</option>
            {options.availableCatalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id as string}>
                {catalog.name}
              </option>
            ))}
          </select>

          <select
            className="h-9 min-w-[8rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 md:w-40"
            value={filters.sort}
            onChange={(event) =>
              onFiltersChange({ sort: event.target.value as SearchSortOption })
            }
            aria-label="Sort order"
          >
            <option value="relevance">Relevance</option>
            <option value="updatedAtDesc">Updated (newest)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs text-zinc-700 dark:text-zinc-300"
              onClick={onResetFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {isOptionsLoading ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Loading tags and catalogs...
        </div>
      ) : null}

      {optionsErrorMessage ? (
        <div className="flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
          <span>{optionsErrorMessage}</span>
          <Button
            type="button"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={onRetryLoadOptions}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TagMultiSelect
// ---------------------------------------------------------------------------

interface TagMultiSelectProps {
  selectedTagIds: TagId[]
  availableTags: { id: string; name: string }[]
  onSelectionChange: (tagIds: TagId[]) => void
}

function TagMultiSelect({
  selectedTagIds,
  availableTags,
  onSelectionChange,
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedCount = selectedTagIds.length

  const handleToggleTag = (tagId: TagId, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTagIds, tagId])
    } else {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId))
    }
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-[8rem] items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none hover:bg-zinc-50 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 md:w-40"
          aria-label="Filter by tags"
        >
          <span className="truncate">
            {selectedCount === 0
              ? "All tags"
              : selectedCount === 1
                ? "1 tag"
                : `${selectedCount} tags`}
          </span>
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-2">
          {availableTags.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              No tags available
            </p>
          ) : (
            <div className="space-y-1">
              {availableTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id as TagId)
                return (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleToggleTag(tag.id as TagId, checked === true)
                      }
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        {selectedCount > 0 ? (
          <div className="border-t border-zinc-200 p-2 dark:border-zinc-700">
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear selection
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// SearchResultsList
// ---------------------------------------------------------------------------

interface SearchResultsListProps {
  results: SearchResultItemVm[]
  onOpenPrompt: (promptId: PromptId) => void
  isLoading: boolean
}

function SearchResultsList({
  results,
  onOpenPrompt,
  isLoading,
}: SearchResultsListProps) {
  return (
    <div
      className={`space-y-2 rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950 ${isLoading ? "opacity-60" : ""}`}
    >
      <ul className="space-y-2">
        {results.map((result) => (
          <SearchResultCard
            key={result.id}
            result={result}
            onOpen={() => onOpenPrompt(result.id)}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchResultCard
// ---------------------------------------------------------------------------

interface SearchResultCardProps {
  result: SearchResultItemVm
  onOpen: () => void
}

function SearchResultCard({ result, onOpen }: SearchResultCardProps) {
  return (
    <li className="rounded-md border border-zinc-100 bg-zinc-50/50 p-3 transition-colors hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="text-left text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
            aria-label={`Open prompt ${result.title}`}
          >
            {result.title}
          </button>
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
              title={`Relevance: ${result.scorePercentage}%`}
            >
              {result.scorePercentage}%
            </span>
          </div>
        </div>

        {result.snippet ? (
          <div
            className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400 [&_b]:font-semibold [&_b]:text-zinc-900 dark:[&_b]:text-zinc-100"
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {result.catalog ? (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {result.catalog.name}
            </span>
          ) : null}

          {result.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {result.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                >
                  {tag.name}
                </span>
              ))}
            </span>
          ) : null}

          <span className="ml-auto text-[10px]">
            Updated {result.updatedAtLabel}
          </span>
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// SearchPagination
// ---------------------------------------------------------------------------

interface SearchPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function SearchPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: SearchPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} results
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {maxPage}
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={page >= maxPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchEmptyState
// ---------------------------------------------------------------------------

interface SearchEmptyStateProps {
  query: string
  hasFilters: boolean
  onResetFilters: () => void
}

function SearchEmptyState({
  query,
  hasFilters,
  onResetFilters,
}: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <svg
        className="h-12 w-12 text-zinc-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"
        />
      </svg>
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          No results found for &quot;{query}&quot;
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Try different keywords, check your spelling, or broaden your filters.
        </p>
      </div>
      {hasFilters ? (
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={onResetFilters}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPromptState (shown when no query entered)
// ---------------------------------------------------------------------------

function SearchPromptState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <svg
        className="h-12 w-12 text-zinc-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"
        />
      </svg>
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Enter a search term
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Search across your prompts by title, content, and catalog names.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchErrorState
// ---------------------------------------------------------------------------

interface SearchErrorStateProps {
  errorMessage: string
  onRetry: () => void
}

function SearchErrorState({ errorMessage, onRetry }: SearchErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
      <div className="flex items-center justify-between gap-2">
        <span>{errorMessage}</span>
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchLoadingSkeleton
// ---------------------------------------------------------------------------

function SearchLoadingSkeleton() {
  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-md border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="ml-auto h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

