'use client'

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import type { ErrorResponseDto, PromptId, RunId, RunStatus } from "@/types"

import {
  getInitialRunsFilters,
  useRunDetail,
  useRunsFilters,
  useRunsListData,
} from "./hooks"
import {
  searchParamsRecordToURLSearchParams,
  type SearchParamsRecord,
  type RunDetailVm,
  type RunListItemVm,
  type RunsFiltersVm,
} from "./view-types"

// ---------------------------------------------------------------------------
// RunStatusBadge
// ---------------------------------------------------------------------------

interface RunStatusBadgeProps {
  status: RunStatus
}

function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const baseClasses =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"

  let colorClasses: string
  let label: string

  switch (status) {
    case "success":
      colorClasses =
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      label = "Success"
      break
    case "error":
      colorClasses =
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
      label = "Error"
      break
    case "pending":
      colorClasses =
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      label = "Pending"
      break
    case "timeout":
      colorClasses =
        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      label = "Timeout"
      break
    default:
      colorClasses =
        "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      label = "Unknown"
  }

  return (
    <span
      className={`${baseClasses} ${colorClasses}`}
      aria-label={`Run status: ${label}`}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// RunListItem
// ---------------------------------------------------------------------------

interface RunListItemProps {
  run: RunListItemVm
  isSelected: boolean
  onSelect: () => void
}

function RunListItem({ run, isSelected, onSelect }: RunListItemProps) {
  return (
    <li
      className={`flex flex-col gap-1 px-3 py-2 md:flex-row md:items-center md:justify-between ${
        isSelected
          ? "bg-zinc-100 dark:bg-zinc-800/50"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      }`}
    >
      <button
        type="button"
        className="flex flex-1 flex-col gap-1 text-left md:flex-row md:items-center md:gap-3"
        onClick={onSelect}
        aria-label={`View run from ${run.createdAtLabel}`}
      >
        <RunStatusBadge status={run.status} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {run.model}
          </span>
          <span>·</span>
          <span>{run.latencyLabel}</span>
          <span>·</span>
          <span>{run.createdAtLabel}</span>
        </div>
      </button>

      <div className="mt-1 flex items-center gap-2 md:mt-0">
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onSelect}
        >
          View
        </Button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// RunsFiltersBar
// ---------------------------------------------------------------------------

interface RunsFiltersBarProps {
  filters: RunsFiltersVm
  onStatusChange: (status: RunStatus | null) => void
}

function RunsFiltersBar({ filters, onStatusChange }: RunsFiltersBarProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            Status:
          </label>
          <select
            id="status-filter"
            className="h-8 min-w-[8rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            value={filters.status ?? ""}
            onChange={(event) => {
              const value = event.target.value
              onStatusChange(value === "" ? null : (value as RunStatus))
            }}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RunsListContainer
// ---------------------------------------------------------------------------

interface RunsListContainerProps {
  runs: RunListItemVm[]
  selectedRunId: RunId | null
  onSelectRun: (runId: RunId) => void
}

function RunsListContainer({
  runs,
  selectedRunId,
  onSelectRun,
}: RunsListContainerProps) {
  return (
    <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {runs.map((run) => (
          <RunListItem
            key={run.id}
            run={run}
            isSelected={selectedRunId === run.id}
            onSelect={() => onSelectRun(run.id)}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RunsListPagination
// ---------------------------------------------------------------------------

interface RunsListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function RunsListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: RunsListPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} runs
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
// RunsListEmptyState
// ---------------------------------------------------------------------------

interface RunsListEmptyStateProps {
  hasFilter: boolean
  onClearFilters: () => void
}

function RunsListEmptyState({
  hasFilter,
  onClearFilters,
}: RunsListEmptyStateProps) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <p>No runs match the current filter.</p>
        <Button
          type="button"
          variant="ghost"
          className="px-2 text-xs"
          onClick={onClearFilters}
        >
          Clear filter
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <p>This prompt has not been run yet.</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Go to the Overview tab to run the prompt.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RunsListErrorState
// ---------------------------------------------------------------------------

interface RunsListErrorStateProps {
  error: ErrorResponseDto
  onRetry: () => void
}

function RunsListErrorState({ error, onRetry }: RunsListErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
      <div className="flex items-center justify-between gap-2">
        <span>{error.error.message}</span>
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
// RunDetailPanel
// ---------------------------------------------------------------------------

interface RunDetailPanelProps {
  run: RunDetailVm | null
  isLoading: boolean
  error: ErrorResponseDto | null
  onClose: () => void
}

function RunDetailPanel({
  run,
  isLoading,
  error,
  onClose,
}: RunDetailPanelProps) {
  const handleCopyOutput = async () => {
    if (!run?.outputText) return
    try {
      await navigator.clipboard.writeText(run.outputText)
    } catch {
      // Silent failure; future iteration can add toast notification
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-zinc-600 dark:text-zinc-300">
          Loading run details...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40">
        <CardContent className="flex items-center justify-between gap-2 py-4 text-sm text-red-800 dark:text-red-200">
          <span>{error.error.message}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!run) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Run Details</CardTitle>
          <RunStatusBadge status={run.status} />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onClose}
        >
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 py-3">
        {/* Metadata Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            Metadata
          </h4>
          <div className="grid gap-2 text-xs md:grid-cols-2">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Model: </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {run.model}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">
                Latency:{" "}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {run.latencyLabel}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">
                Created:{" "}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {run.createdAtLabel}
              </span>
            </div>
            {run.tokenUsageLabel ? (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tokens:{" "}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {run.tokenUsageLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            Input
          </h4>
          {Object.keys(run.input.variables).length > 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
              <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                {JSON.stringify(run.input.variables, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No input variables provided.
            </p>
          )}
          {run.input.overridePrompt ? (
            <div className="space-y-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Override prompt:
              </span>
              <div className="max-h-32 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                  {run.input.overridePrompt}
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        {/* Output Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Output
            </h4>
            {run.outputText ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={handleCopyOutput}
              >
                Copy
              </Button>
            ) : null}
          </div>
          {run.outputText ? (
            <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
              <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                {run.outputText}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No output available.
            </p>
          )}
        </div>

        {/* Error Section */}
        {run.status === "error" && run.errorMessage ? (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-red-700 dark:text-red-400">
              Error
            </h4>
            <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
              <p className="text-xs text-red-800 dark:text-red-200">
                {run.errorMessage}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// PromptDetailRunsView (Main Component)
// ---------------------------------------------------------------------------

interface PromptDetailRunsViewProps {
  promptId: PromptId
  initialSearchParams?: SearchParamsRecord
}

export function PromptDetailRunsView({
  promptId,
  initialSearchParams,
}: PromptDetailRunsViewProps) {
  const initialFilters = useMemo(() => {
    const urlSearchParams = initialSearchParams
      ? searchParamsRecordToURLSearchParams(initialSearchParams)
      : new URLSearchParams()
    return getInitialRunsFilters(urlSearchParams)
  }, [initialSearchParams])

  const { filters, updateFilters, resetFilters } = useRunsFilters(initialFilters)
  const { state, reload } = useRunsListData(promptId, filters)
  const {
    state: detailState,
    selectRun,
    clearSelection,
  } = useRunDetail()

  const hasResults = state.total > 0
  const hasFilter = filters.status !== null

  return (
    <section className="space-y-4">
      <RunsFiltersBar
        filters={filters}
        onStatusChange={(status) => updateFilters({ status })}
      />

      {state.error ? (
        <RunsListErrorState error={state.error} onRetry={reload} />
      ) : null}

      {state.isLoading && state.isInitialLoad ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading runs...
        </div>
      ) : null}

      {!state.isLoading && !hasResults && !state.error ? (
        <RunsListEmptyState hasFilter={hasFilter} onClearFilters={resetFilters} />
      ) : null}

      {hasResults ? (
        <RunsListContainer
          runs={state.items}
          selectedRunId={detailState.selectedRunId}
          onSelectRun={selectRun}
        />
      ) : null}

      {hasResults ? (
        <RunsListPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}

      {detailState.selectedRunId ? (
        <RunDetailPanel
          run={detailState.run}
          isLoading={detailState.isLoading}
          error={detailState.error}
          onClose={clearSelection}
        />
      ) : null}
    </section>
  )
}

export default PromptDetailRunsView
