'use client'

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

import type {
  ErrorResponseDto,
  PromptDetailDto,
  PromptId,
  PromptVersionId,
} from "@/types"

import {
  getInitialVersionsFilters,
  useVersionsFilters,
  useVersionsListData,
  useVersionDetail,
} from "./hooks"
import {
  searchParamsRecordToURLSearchParams,
  type SearchParamsRecord,
  type VersionListItemVm,
  type VersionDetailVm,
} from "./view-types"

// ---------------------------------------------------------------------------
// CurrentVersionBadge
// ---------------------------------------------------------------------------

function CurrentVersionBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      aria-label="Current version"
    >
      Current
    </span>
  )
}

// ---------------------------------------------------------------------------
// VersionListItem
// ---------------------------------------------------------------------------

interface VersionListItemProps {
  version: VersionListItemVm
  isSelected: boolean
  onSelect: () => void
}

function VersionListItem({
  version,
  isSelected,
  onSelect,
}: VersionListItemProps) {
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
        aria-label={`View version from ${version.createdAtLabel}`}
      >
        {version.isCurrent ? <CurrentVersionBadge /> : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {version.title}
          </span>
          {version.summary ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {version.summary}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 md:ml-auto">
          {version.createdAtLabel}
        </span>
      </button>

      <div className="mt-1 flex items-center gap-2 md:mt-0 md:ml-3">
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
// VersionsListContainer
// ---------------------------------------------------------------------------

interface VersionsListContainerProps {
  versions: VersionListItemVm[]
  selectedVersionId: PromptVersionId | null
  onSelectVersion: (versionId: PromptVersionId) => void
}

function VersionsListContainer({
  versions,
  selectedVersionId,
  onSelectVersion,
}: VersionsListContainerProps) {
  return (
    <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {versions.map((version) => (
          <VersionListItem
            key={version.id}
            version={version}
            isSelected={selectedVersionId === version.id}
            onSelect={() => onSelectVersion(version.id)}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VersionsListPagination
// ---------------------------------------------------------------------------

interface VersionsListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function VersionsListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: VersionsListPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} versions
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
// VersionsListEmptyState
// ---------------------------------------------------------------------------

function VersionsListEmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <p>This prompt has no versions.</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Versions are created when you save changes to the prompt content.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VersionsListErrorState
// ---------------------------------------------------------------------------

interface VersionsListErrorStateProps {
  error: ErrorResponseDto
  onRetry: () => void
}

function VersionsListErrorState({
  error,
  onRetry,
}: VersionsListErrorStateProps) {
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
// VersionDetailPanel
// ---------------------------------------------------------------------------

interface VersionDetailPanelProps {
  version: VersionDetailVm | null
  isLoading: boolean
  error: ErrorResponseDto | null
  isRestoring: boolean
  restoreError: ErrorResponseDto | null
  showRestoreConfirmation: boolean
  restoreSummary: string
  onClose: () => void
  onStartRestore: () => void
  onCancelRestore: () => void
  onSetRestoreSummary: (summary: string) => void
  onConfirmRestore: () => void
  onCopy: () => void
}

function VersionDetailPanel({
  version,
  isLoading,
  error,
  isRestoring,
  restoreError,
  showRestoreConfirmation,
  restoreSummary,
  onClose,
  onStartRestore,
  onCancelRestore,
  onSetRestoreSummary,
  onConfirmRestore,
  onCopy,
}: VersionDetailPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-zinc-600 dark:text-zinc-300">
          Loading version details...
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

  if (!version) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{version.title}</CardTitle>
          {version.isCurrent ? <CurrentVersionBadge /> : null}
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
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Created: {version.createdAtLabel}
          </p>
          {version.summary ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Summary: {version.summary}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {version.contentCharCount.toLocaleString()} characters
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            Content
          </h4>
          <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
            <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
              {version.content}
            </pre>
          </div>
        </div>

        {/* Restore Error */}
        {restoreError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
            <p className="text-xs text-red-800 dark:text-red-200">
              {restoreError.error.message}
            </p>
          </div>
        ) : null}

        {/* Restore Confirmation */}
        {showRestoreConfirmation ? (
          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Restoring this version will create a new version with the same
              content and set it as the current version.
            </p>
            <div className="space-y-1">
              <label
                htmlFor="restore-summary"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-200"
              >
                Restore summary (optional)
              </label>
              <Textarea
                id="restore-summary"
                rows={2}
                className="text-xs"
                placeholder="Describe why you're restoring this version..."
                value={restoreSummary}
                onChange={(e) => onSetRestoreSummary(e.target.value)}
                maxLength={1000}
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {restoreSummary.length}/1000 characters
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="text-xs"
                disabled={isRestoring}
                onClick={onConfirmRestore}
              >
                {isRestoring ? "Restoring..." : "Confirm Restore"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled={isRestoring}
                onClick={onCancelRestore}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        {!showRestoreConfirmation ? (
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={onCopy}
            >
              Copy Content
            </Button>
            {!version.isCurrent ? (
              <Button
                type="button"
                size="sm"
                className="text-xs"
                onClick={onStartRestore}
              >
                Restore This Version
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// useCurrentVersionId - Hook to fetch the current version ID
// ---------------------------------------------------------------------------

function useCurrentVersionId(promptId: PromptId) {
  const [currentVersionId, setCurrentVersionId] =
    useState<PromptVersionId | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/prompts/${encodeURIComponent(promptId)}?includeVersions=false&includeRuns=false`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      )

      if (response.ok) {
        const data = (await response.json()) as PromptDetailDto
        setCurrentVersionId(data.currentVersion?.id ?? null)
      }
    } catch {
      // Silent failure - currentVersionId will remain null
    } finally {
      setIsLoading(false)
    }
  }, [promptId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { currentVersionId, isLoading, refetch }
}

// ---------------------------------------------------------------------------
// PromptDetailVersionsView (Main Component)
// ---------------------------------------------------------------------------

interface PromptDetailVersionsViewProps {
  promptId: PromptId
  initialSearchParams?: SearchParamsRecord
}

export function PromptDetailVersionsView({
  promptId,
  initialSearchParams,
}: PromptDetailVersionsViewProps) {
  const initialFilters = useMemo(() => {
    const urlSearchParams = initialSearchParams
      ? searchParamsRecordToURLSearchParams(initialSearchParams)
      : new URLSearchParams()
    return getInitialVersionsFilters(urlSearchParams)
  }, [initialSearchParams])

  const {
    currentVersionId,
    isLoading: isLoadingCurrentVersion,
    refetch: refetchCurrentVersion,
  } = useCurrentVersionId(promptId)

  const { filters, updateFilters } = useVersionsFilters(initialFilters)
  const { state, reload } = useVersionsListData(
    promptId,
    currentVersionId,
    filters,
  )
  const {
    state: detailState,
    selectVersion,
    clearSelection,
    startRestore,
    cancelRestore,
    setRestoreSummary,
    confirmRestore,
  } = useVersionDetail(promptId, currentVersionId)

  const hasResults = state.total > 0
  const isInitialLoading =
    (state.isLoading && state.isInitialLoad) || isLoadingCurrentVersion

  const handleCopyContent = async () => {
    if (!detailState.version?.content) return
    try {
      await navigator.clipboard.writeText(detailState.version.content)
    } catch {
      // Silent failure; future iteration can add toast notification
    }
  }

  const handleConfirmRestore = async () => {
    const result = await confirmRestore()
    if (result) {
      // After successful restore, refetch current version and reload the list
      await refetchCurrentVersion()
      reload()
      clearSelection()
    }
  }

  return (
    <section className="space-y-4">
      {state.error ? (
        <VersionsListErrorState error={state.error} onRetry={reload} />
      ) : null}

      {isInitialLoading ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading versions...
        </div>
      ) : null}

      {!isInitialLoading && !hasResults && !state.error ? (
        <VersionsListEmptyState />
      ) : null}

      {!isInitialLoading && hasResults ? (
        <VersionsListContainer
          versions={state.items}
          selectedVersionId={detailState.selectedVersionId}
          onSelectVersion={selectVersion}
        />
      ) : null}

      {!isInitialLoading && hasResults ? (
        <VersionsListPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}

      {detailState.selectedVersionId ? (
        <VersionDetailPanel
          version={detailState.version}
          isLoading={detailState.isLoading}
          error={detailState.error}
          isRestoring={detailState.isRestoring}
          restoreError={detailState.restoreError}
          showRestoreConfirmation={detailState.showRestoreConfirmation}
          restoreSummary={detailState.restoreSummary}
          onClose={clearSelection}
          onStartRestore={startRestore}
          onCancelRestore={cancelRestore}
          onSetRestoreSummary={setRestoreSummary}
          onConfirmRestore={handleConfirmRestore}
          onCopy={handleCopyContent}
        />
      ) : null}
    </section>
  )
}

export default PromptDetailVersionsView
