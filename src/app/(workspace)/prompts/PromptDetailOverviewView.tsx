'use client'

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type { CatalogId, PromptId, TagId } from "@/types"

import {
  useImprovePrompt,
  useOfflineStatus,
  usePromptDetailOverview,
  useRunPrompt,
} from "./hooks"
import {
  PROMPT_CONTENT_MAX,
  type PromptDetailEditorState,
  type PromptDetailVm,
} from "./view-types"

interface PromptDetailOverviewViewProps {
  promptId: PromptId
}

export function PromptDetailOverviewView({
  promptId,
}: PromptDetailOverviewViewProps) {
  const {
    state,
    reloadPrompt,
    setDraftTitle,
    setDraftCatalog,
    setDraftTags,
    setDraftContent,
    setDraftSummary,
    savePrompt,
    deletePrompt,
  } = usePromptDetailOverview(promptId)

  const isOffline = useOfflineStatus()

  const { isRunning, error: runError, runPrompt } = useRunPrompt(
    promptId,
    () => state.editor.draftContent,
  )

  const {
    state: improveState,
    startImprove,
    closePanel,
    selectSuggestion,
    changeSuggestionDraft,
    saveSuggestion,
  } = useImprovePrompt(promptId, () => state.editor.draftContent)

  const canSave = useMemo(
    () =>
      !isOffline &&
      state.editor.isDirty &&
      !state.editor.contentAtLimit &&
      !state.editor.isSavingVersion &&
      !state.editor.isSavingMetadataOnly,
    [
      isOffline,
      state.editor.contentAtLimit,
      state.editor.isDirty,
      state.editor.isSavingMetadataOnly,
      state.editor.isSavingVersion,
    ],
  )

  const canRun = useMemo(
    () =>
      !isOffline &&
      !state.editor.contentAtLimit &&
      !isRunning,
    [isOffline, isRunning, state.editor.contentAtLimit],
  )

  const canImprove = useMemo(
    () =>
      !isOffline &&
      !state.editor.contentAtLimit &&
      !improveState.isLoading,
    [
      improveState.isLoading,
      isOffline,
      state.editor.contentAtLimit,
    ],
  )

  if (state.isLoadingInitial) {
    return (
      <section className="space-y-4">
        <Card>
          <CardContent className="py-6 text-sm text-zinc-600 dark:text-zinc-300">
            Loading prompt...
          </CardContent>
        </Card>
      </section>
    )
  }

  if (state.error) {
    return (
      <section className="space-y-4">
        <Card className="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40">
          <CardContent className="flex items-center justify-between gap-2 py-4 text-sm text-red-800 dark:text-red-200">
            <span>{state.error.error.message}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={reloadPrompt}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!state.prompt) {
    return (
      <section className="space-y-4">
        <Card>
          <CardContent className="py-6 text-sm text-zinc-700 dark:text-zinc-200">
            Prompt not found.
          </CardContent>
        </Card>
      </section>
    )
  }

  const { prompt, editor } = state

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Prompt overview</CardTitle>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Edit the prompt content and metadata, then run or improve it.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Title
            </label>
            <Input
              value={editor.draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Prompt title"
            />
            {editor.fieldErrors.title ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {editor.fieldErrors.title[0]}
              </p>
            ) : null}
          </div>

          {/* Catalog and tags are wired but use simple controls for now.
              They will be refined in later steps to match the full plan. */}
          <div className="flex flex-col gap-2 md:flex-row md:gap-4">
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Catalog
              </label>
              <Input
                value={editor.draftCatalogId ?? ""}
                onChange={(event) =>
                  setDraftCatalog(
                    (event.target.value || null) as CatalogId | null,
                  )
                }
                placeholder="Catalog ID (temporary input)"
              />
              {editor.fieldErrors.catalogId ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {editor.fieldErrors.catalogId[0]}
                </p>
              ) : null}
            </div>

            <div className="flex-1 space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Tag IDs
              </label>
              <Input
                value={editor.draftTagIds.join(",")}
                onChange={(event) =>
                  setDraftTags(
                    event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean) as TagId[],
                  )
                }
                placeholder="Comma-separated tag IDs (temporary input)"
              />
              {editor.fieldErrors.tagIds ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {editor.fieldErrors.tagIds[0]}
                </p>
              ) : null}
            </div>
          </div>

          <PromptContentEditor
            editor={editor}
            onChangeDraftContent={setDraftContent}
            onChangeDraftSummary={setDraftSummary}
          />

          {editor.formErrorMessage ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {editor.formErrorMessage}
            </p>
          ) : null}

          {runError ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {runError.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              onClick={() => {
                void savePrompt()
              }}
            >
              {editor.isSavingVersion || editor.isSavingMetadataOnly
                ? "Saving..."
                : "Save"}
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!canRun}
              onClick={() => {
                void runPrompt()
              }}
            >
              {isRunning ? "Running..." : "Run"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canImprove}
              onClick={() => {
                void startImprove()
              }}
            >
              {improveState.isLoading ? "Improving..." : "Improve"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(editor.draftContent)
                  .catch(() => {
                    // Silent failure; a future iteration can surface this via toast.
                  })
              }}
            >
              Copy
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              disabled={state.isDeleting}
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete prompt "${prompt.title}"? This cannot be undone.`,
                )
                if (!confirmed) return
                void deletePrompt()
              }}
            >
              {state.isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PromptResultPanel prompt={prompt} />

      {/* Improve suggestions panel placeholder for now */}
      {improveState.isOpen ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Improve suggestions</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={closePanel}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 py-3">
            {improveState.error ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {improveState.error.error.message}
              </p>
            ) : null}

            {improveState.suggestions.length === 0 && !improveState.isLoading ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                No suggestions returned.
              </p>
            ) : null}

            {improveState.suggestions.length > 0 ? (
              <div className="space-y-3">
                {improveState.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`space-y-2 rounded-md border px-3 py-2 text-xs ${
                      suggestion.isSelected
                        ? "border-zinc-800 dark:border-zinc-200"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <button
                      type="button"
                      className="block w-full text-left font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                      onClick={() => selectSuggestion(suggestion.id)}
                    >
                      {suggestion.title}
                    </button>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {suggestion.summary || "No summary provided."}
                    </p>
                    {suggestion.tokenUsageLabel ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {suggestion.tokenUsageLabel}
                      </p>
                    ) : null}
                    {suggestion.isSelected ? (
                      <div className="space-y-1 pt-2">
                        <Textarea
                          rows={6}
                          className="text-xs"
                          value={suggestion.editedContent}
                          onChange={(event) =>
                            changeSuggestionDraft(suggestion.id, {
                              editedContent: event.target.value,
                            })
                          }
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="text-xs"
                            onClick={async () => {
                              const result = await saveSuggestion(
                                suggestion.id,
                                state.prompt?.currentVersionId ?? null,
                              )
                              if (result) {
                                // After saving, reload the prompt so the improved version
                                // becomes the new current version.
                                await reloadPrompt()
                              }
                            }}
                          >
                            Save as new version
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

interface PromptContentEditorProps {
  editor: PromptDetailEditorState
  onChangeDraftContent(content: string): void
  onChangeDraftSummary(summary: string): void
}

function PromptContentEditor({
  editor,
  onChangeDraftContent,
  onChangeDraftSummary,
}: PromptContentEditorProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Prompt content
        </label>
        <Textarea
          value={editor.draftContent}
          onChange={(event) => onChangeDraftContent(event.target.value)}
          rows={12}
          className="text-sm"
          placeholder="Enter the prompt content..."
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              editor.contentAtLimit
                ? "text-red-600 dark:text-red-400"
                : editor.contentNearLimit
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-500 dark:text-zinc-400"
            }
          >
            {editor.contentCharCount.toLocaleString()} /{" "}
            {PROMPT_CONTENT_MAX.toLocaleString()} characters
          </span>
        </div>
        {editor.fieldErrors.content ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {editor.fieldErrors.content[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Change summary (optional)
        </label>
        <Textarea
          value={editor.draftSummary}
          onChange={(event) => onChangeDraftSummary(event.target.value)}
          rows={3}
          className="text-xs"
          placeholder="Describe what changed in this version (optional)..."
        />
        {editor.fieldErrors.summary ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {editor.fieldErrors.summary[0]}
          </p>
        ) : null}
      </div>
    </>
  )
}

interface PromptResultPanelProps {
  prompt: PromptDetailVm
}

function PromptResultPanel({ prompt }: PromptResultPanelProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Last run</CardTitle>
      </CardHeader>
      <CardContent className="py-3 text-xs text-zinc-600 dark:text-zinc-300">
        {prompt.lastRun ? (
          <div className="space-y-1">
            <p>
              Status:{" "}
              <span className="font-medium">{prompt.lastRunStatusLabel}</span>
            </p>
            {prompt.lastRunTimestampLabel ? (
              <p>At: {prompt.lastRunTimestampLabel}</p>
            ) : null}
            {prompt.lastRun.model ? <p>Model: {prompt.lastRun.model}</p> : null}
            {typeof prompt.lastRun.latencyMs === "number" ? (
              <p>Latency: {prompt.lastRun.latencyMs} ms</p>
            ) : null}
          </div>
        ) : (
          <p>Prompt has never been run.</p>
        )}
      </CardContent>
    </Card>
  )
}

export default PromptDetailOverviewView

