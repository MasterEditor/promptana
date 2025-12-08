'use client'

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { TagId } from "@/types"

import {
  getInitialDensity,
  setDensityPreference,
  usePromptFiltersOptions,
  usePromptListData,
  usePromptListFilters,
} from "./hooks"
import { usePromptRowActions } from "./row-actions-hook"
import type {
  PromptDensityMode,
  PromptFiltersOptionsVm,
  PromptListFiltersVm,
  PromptListItemVm,
} from "./view-types"

interface PromptsViewProps {
  initialFilters: PromptListFiltersVm
}

export default function PromptsView({ initialFilters }: PromptsViewProps) {
  const [density, setDensity] = useState<PromptDensityMode>(() =>
    getInitialDensity(),
  )

  const { filters, updateFilters, resetFilters } = usePromptListFilters(
    initialFilters,
  )
  const { state, reload } = usePromptListData(filters)
  const {
    options,
    isLoading: isOptionsLoading,
    error: optionsError,
    refresh: refreshOptions,
  } = usePromptFiltersOptions()

  const {
    canRun,
    canDelete,
    deletingPromptId,
    runPrompt,
    openPrompt,
    deletePrompt,
  } = usePromptRowActions({
    onDeleted: reload,
  })

  const itemsWithCapabilities: PromptListItemVm[] = useMemo(
    () =>
      state.items.map((item) => ({
        ...item,
        canRun,
        canDelete,
      })),
    [state.items, canRun, canDelete],
  )

  function handleDensityChange(mode: PromptDensityMode) {
    setDensity(mode)
    setDensityPreference(mode)
  }

  const hasResults = state.total > 0

  return (
    <section className="space-y-4">
      <PromptFiltersBar
        filters={filters}
        density={density}
        options={options}
        isOptionsLoading={isOptionsLoading}
        onFiltersChange={updateFilters}
        onResetFilters={resetFilters}
        onDensityChange={handleDensityChange}
        optionsErrorMessage={optionsError?.error.message}
        onRetryLoadOptions={refreshOptions}
      />

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-center justify-between gap-2">
            <span>{state.error.error.message}</span>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={reload}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {state.isLoading && state.isInitialLoad ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading prompts...
        </div>
      ) : null}

      {!state.isLoading && !hasResults ? (
        <PromptListEmptyState
          filters={filters}
          onResetFilters={resetFilters}
        />
      ) : null}

      {hasResults ? (
        <PromptListContainer
          prompts={itemsWithCapabilities}
          density={density}
          canRun={canRun}
          canDelete={canDelete}
          deletingPromptId={deletingPromptId}
          onRun={runPrompt}
          onOpen={openPrompt}
          onDelete={(prompt) => {
            // Open a lightweight confirmation dialog. This satisfies the
            // requirement that destructive actions require confirmation.
            const confirmed = window.confirm(
              `Delete prompt "${prompt.title}"? This cannot be undone.`,
            )
            if (!confirmed) return
            void deletePrompt(prompt)
          }}
        />
      ) : null}

      {hasResults ? (
        <PromptListPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}
    </section>
  )
}

interface PromptFiltersBarProps {
  filters: PromptListFiltersVm
  density: PromptDensityMode
  options: PromptFiltersOptionsVm
  isOptionsLoading: boolean
  onFiltersChange(partial: Partial<PromptListFiltersVm>): void
  onResetFilters(): void
  onDensityChange(mode: PromptDensityMode): void
  optionsErrorMessage?: string
  onRetryLoadOptions(): void
}

function PromptFiltersBar({
  filters,
  density,
  options,
  isOptionsLoading,
  onFiltersChange,
  onResetFilters,
  onDensityChange,
  optionsErrorMessage,
  onRetryLoadOptions,
}: PromptFiltersBarProps) {
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.tagIds.length > 0 ||
    filters.catalogId !== null ||
    filters.sort !== "updatedAtDesc"

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row">
          <input
            type="search"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Search prompts..."
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ search: event.target.value })
            }
          />

          <TagMultiSelect
            selectedTagIds={filters.tagIds as TagId[]}
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
              onFiltersChange({ sort: event.target.value as any })
            }
          >
            <option value="updatedAtDesc">Updated (newest)</option>
            <option value="createdAtDesc">Created (newest)</option>
            <option value="titleAsc">Title (A–Z)</option>
            <option value="lastRunDesc">Last run (newest)</option>
            <option value="relevance">Relevance</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            <Button
              type="button"
              variant={density === "comfortable" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => onDensityChange("comfortable")}
            >
              Comfortable
            </Button>
            <Button
              type="button"
              variant={density === "compact" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => onDensityChange("compact")}
            >
              Compact
            </Button>
          </div>

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

interface PromptListContainerProps {
  prompts: PromptListItemVm[]
  density: PromptDensityMode
  canRun: boolean
  canDelete: boolean
  deletingPromptId: string | null
  onRun(prompt: PromptListItemVm): void
  onOpen(prompt: PromptListItemVm): void
  onDelete(prompt: PromptListItemVm): void
}

function PromptListContainer({
  prompts,
  density,
  canRun,
  canDelete,
  deletingPromptId,
  onRun,
  onOpen,
  onDelete,
}: PromptListContainerProps) {
  return (
    <div
      className={
        density === "compact"
          ? "divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950"
          : "space-y-2 rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      }
    >
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {prompts.map((prompt) => {
          const isDeleting = deletingPromptId === prompt.id

          return (
            <li
              key={prompt.id}
              className="flex flex-col gap-1 px-3 py-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(prompt)}
                    className="text-left text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                    aria-label={`Open prompt ${prompt.title}`}
                  >
                    {prompt.title}
                  </button>
                  <PromptLastRunBadge prompt={prompt} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {prompt.tags.length > 0 ? (
                    <span>
                      Tags: {prompt.tags.map((tag) => tag.name).join(", ")}
                    </span>
                  ) : null}
                  {prompt.catalogId ? <span>Catalog assigned</span> : null}
                  <span>Updated: {prompt.updatedAtLabel}</span>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2 md:mt-0">
                <PromptRowActions
                  prompt={prompt}
                  canRun={canRun}
                  canDelete={canDelete}
                  isDeleting={isDeleting}
                  onRun={onRun}
                  onOpen={onOpen}
                  onDelete={onDelete}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface PromptRowActionsProps {
  prompt: PromptListItemVm
  canRun: boolean
  canDelete: boolean
  isDeleting: boolean
  onRun(prompt: PromptListItemVm): void
  onOpen(prompt: PromptListItemVm): void
  onDelete(prompt: PromptListItemVm): void
}

function PromptRowActions({
  prompt,
  canRun,
  canDelete,
  isDeleting,
  onRun,
  onOpen,
  onDelete,
}: PromptRowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        className="h-8 px-3 text-xs"
        disabled={!canRun}
        onClick={() => onRun(prompt)}
        aria-label={`Run prompt ${prompt.title}`}
      >
        Run
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-3 text-xs"
        onClick={() => onOpen(prompt)}
        aria-label={`Open prompt ${prompt.title}`}
      >
        Open
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-3 text-xs text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        disabled={!canDelete || isDeleting}
        onClick={() => onDelete(prompt)}
        aria-label={`Delete prompt ${prompt.title}`}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  )
}

interface PromptLastRunBadgeProps {
  prompt: PromptListItemVm
}

function PromptLastRunBadge({ prompt }: PromptLastRunBadgeProps) {
  const hasRun = !!prompt.lastRun

  const baseClasses =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"

  let colorClasses =
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"

  if (prompt.lastRun?.status === "success") {
    colorClasses =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
  } else if (prompt.lastRun?.status === "error") {
    colorClasses =
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
  }

  return (
    <span
      className={`${baseClasses} ${colorClasses}`}
      aria-label={
        hasRun
          ? `Last run ${prompt.lastRunStatusLabel} at ${prompt.lastRunTimestampLabel ?? ""}`
          : "Never run"
      }
    >
      {hasRun ? prompt.lastRunStatusLabel : "Never run"}
      {prompt.lastRunTimestampLabel
        ? ` · ${prompt.lastRunTimestampLabel}`
        : ""}
    </span>
  )
}

interface PromptListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange(page: number): void
}

function PromptListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PromptListPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} prompts
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

interface PromptListEmptyStateProps {
  filters: PromptListFiltersVm
  onResetFilters(): void
}

function PromptListEmptyState({
  filters,
  onResetFilters,
}: PromptListEmptyStateProps) {
  const hasFilter =
    filters.search.trim().length > 0 ||
    filters.tagIds.length > 0 ||
    filters.catalogId !== null

  if (hasFilter) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <p>No prompts match the current filters.</p>
        <Button
          type="button"
          variant="ghost"
          className="px-2 text-xs"
          onClick={onResetFilters}
        >
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <p>You haven&apos;t created any prompts yet.</p>
      <a
        href="/prompts/new"
        className="text-xs font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
      >
        Create your first prompt
      </a>
    </div>
  )
}
