'use client'

import { useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { CatalogId, PromptId, TagId } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { usePromptFiltersOptions } from "../hooks"

import { useCreatePromptForm } from "./hooks"
import {
  PROMPT_CONTENT_MAX,
  PROMPT_MAX_TAGS,
  PROMPT_SUMMARY_MAX,
  PROMPT_TITLE_MAX,
} from "./view-types"

export default function PromptCreateView() {
  const router = useRouter()

  const {
    formData,
    errors,
    contentMetrics,
    isSubmitting,
    isDirty,
    formErrorMessage,
    duplicateWarning,
    setField,
    validateField,
    submit,
    closeDuplicateWarning,
  } = useCreatePromptForm()

  const {
    options,
    isLoading: isOptionsLoading,
    error: optionsError,
    refresh: refreshOptions,
  } = usePromptFiltersOptions()

  // Dirty form warning
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirty && !isSubmitting) {
        event.preventDefault()
        event.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDirty, isSubmitting])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const promptId = await submit()

      if (promptId && !duplicateWarning.isOpen) {
        router.push(`/prompts/${promptId}`)
      }
    },
    [submit, duplicateWarning.isOpen, router],
  )

  const handleCancel = useCallback(() => {
    router.push("/prompts")
  }, [router])

  const handleDuplicateProceed = useCallback(() => {
    if (duplicateWarning.createdPromptId) {
      router.push(`/prompts/${duplicateWarning.createdPromptId}`)
    }
    closeDuplicateWarning()
  }, [duplicateWarning.createdPromptId, router, closeDuplicateWarning])

  const handleViewSimilar = useCallback((promptId: PromptId) => {
    window.open(`/prompts/${promptId}`, "_blank")
  }, [])

  const handleTagToggle = useCallback(
    (tagId: TagId) => {
      const currentTagIds = formData.tagIds
      const isSelected = currentTagIds.includes(tagId)

      if (isSelected) {
        setField(
          "tagIds",
          currentTagIds.filter((id) => id !== tagId),
        )
      } else {
        if (currentTagIds.length >= PROMPT_MAX_TAGS) {
          return // Don't add if at max
        }
        setField("tagIds", [...currentTagIds, tagId])
      }
    },
    [formData.tagIds, setField],
  )

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/prompts"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
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
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Prompts
      </Link>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Error Message */}
        {formErrorMessage && (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {formErrorMessage}
          </div>
        )}

        {/* Title Field */}
        <div className="space-y-2">
          <label
            htmlFor="title"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setField("title", e.target.value)}
            onBlur={() => validateField("title")}
            disabled={isSubmitting}
            placeholder="Enter a descriptive title for your prompt"
            maxLength={PROMPT_TITLE_MAX}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
            className={errors.title ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          />
          {errors.title && (
            <p id="title-error" className="text-sm text-red-600 dark:text-red-400">
              {errors.title[0]}
            </p>
          )}
        </div>

        {/* Content Field */}
        <div className="space-y-2">
          <label
            htmlFor="content"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Content <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Describe the purpose and context for your prompt. This will be the
            main content sent to the AI model.
          </p>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setField("content", e.target.value)}
            onBlur={() => validateField("content")}
            disabled={isSubmitting}
            placeholder="Enter your prompt content here..."
            rows={12}
            aria-invalid={!!errors.content || contentMetrics.isAtLimit}
            aria-describedby={
              errors.content
                ? "content-error"
                : contentMetrics.isAtLimit
                  ? "content-limit"
                  : undefined
            }
            className={
              errors.content || contentMetrics.isAtLimit
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : contentMetrics.isNearLimit
                  ? "border-amber-500 focus:border-amber-500 focus:ring-amber-500"
                  : ""
            }
          />
          <div className="flex items-center justify-between">
            <div>
              {errors.content && (
                <p
                  id="content-error"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.content[0]}
                </p>
              )}
            </div>
            <CharacterCounter
              current={contentMetrics.charCount}
              max={PROMPT_CONTENT_MAX}
              isNearLimit={contentMetrics.isNearLimit}
              isAtLimit={contentMetrics.isAtLimit}
            />
          </div>
        </div>

        {/* Catalog Field */}
        <div className="space-y-2">
          <label
            htmlFor="catalog"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Catalog <span className="text-zinc-400">(optional)</span>
          </label>
          <select
            id="catalog"
            value={formData.catalogId ?? ""}
            onChange={(e) =>
              setField(
                "catalogId",
                e.target.value === "" ? null : (e.target.value as CatalogId),
              )
            }
            disabled={isSubmitting || isOptionsLoading}
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm outline-none ring-offset-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-offset-zinc-950 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
          >
            <option value="">No catalog</option>
            {options.availableCatalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.name}
              </option>
            ))}
          </select>
          {errors.catalogId && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.catalogId[0]}
            </p>
          )}
        </div>

        {/* Tags Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Tags <span className="text-zinc-400">(optional)</span>
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select up to {PROMPT_MAX_TAGS} tags.{" "}
            {formData.tagIds.length > 0 && (
              <span className="font-medium">
                {formData.tagIds.length} selected
              </span>
            )}
          </p>

          {isOptionsLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading tags...
            </p>
          ) : optionsError ? (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <span>Failed to load tags.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={refreshOptions}
              >
                Retry
              </Button>
            </div>
          ) : options.availableTags.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tags available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              {options.availableTags.map((tag) => {
                const isSelected = formData.tagIds.includes(tag.id)
                const isDisabled =
                  isSubmitting ||
                  (!isSelected && formData.tagIds.length >= PROMPT_MAX_TAGS)

                return (
                  <label
                    key={tag.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
                    } ${isDisabled && !isSelected ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTagToggle(tag.id)}
                      disabled={isDisabled}
                      className="sr-only"
                    />
                    {tag.name}
                  </label>
                )
              })}
            </div>
          )}
          {errors.tagIds && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.tagIds[0]}
            </p>
          )}
        </div>

        {/* Summary Field */}
        <div className="space-y-2">
          <label
            htmlFor="summary"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Version Summary <span className="text-zinc-400">(optional)</span>
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A brief description of this initial version. This helps track
            changes over time.
          </p>
          <Input
            id="summary"
            type="text"
            value={formData.summary}
            onChange={(e) => setField("summary", e.target.value)}
            onBlur={() => validateField("summary")}
            disabled={isSubmitting}
            placeholder="e.g., Initial version"
            maxLength={PROMPT_SUMMARY_MAX}
            aria-invalid={!!errors.summary}
            aria-describedby={errors.summary ? "summary-error" : undefined}
            className={errors.summary ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          />
          {errors.summary && (
            <p id="summary-error" className="text-sm text-red-600 dark:text-red-400">
              {errors.summary[0]}
            </p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || contentMetrics.isAtLimit}
          >
            {isSubmitting ? "Creating..." : "Create Prompt"}
          </Button>
        </div>
      </form>

      {/* Duplicate Warning Dialog */}
      {duplicateWarning.isOpen && duplicateWarning.warning && (
        <DuplicateWarningDialog
          warning={duplicateWarning.warning}
          onProceed={handleDuplicateProceed}
          onCancel={closeDuplicateWarning}
          onViewSimilar={handleViewSimilar}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CharacterCounter Component
// ---------------------------------------------------------------------------

interface CharacterCounterProps {
  current: number
  max: number
  isNearLimit: boolean
  isAtLimit: boolean
}

function CharacterCounter({
  current,
  max,
  isNearLimit,
  isAtLimit,
}: CharacterCounterProps) {
  let colorClass = "text-zinc-500 dark:text-zinc-400"

  if (isAtLimit) {
    colorClass = "text-red-600 dark:text-red-400 font-medium"
  } else if (isNearLimit) {
    colorClass = "text-amber-600 dark:text-amber-400 font-medium"
  }

  return (
    <span className={`text-xs ${colorClass}`}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// DuplicateWarningDialog Component
// ---------------------------------------------------------------------------

interface DuplicateWarningDialogProps {
  warning: {
    similarPromptIds: PromptId[]
    confidence: number
  }
  onProceed: () => void
  onCancel: () => void
  onViewSimilar: (promptId: PromptId) => void
}

function DuplicateWarningDialog({
  warning,
  onProceed,
  onCancel,
  onViewSimilar,
}: DuplicateWarningDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-warning-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        {/* Warning Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600 dark:text-amber-400"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        <h2
          id="duplicate-warning-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Possible Duplicate Detected
        </h2>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your prompt was created, but we found similar existing prompts. You
          may want to review them before proceeding.
        </p>

        {warning.similarPromptIds.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Similar prompts:
            </p>
            <div className="flex flex-wrap gap-2">
              {warning.similarPromptIds.map((promptId) => (
                <button
                  key={promptId}
                  type="button"
                  onClick={() => onViewSimilar(promptId)}
                  className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View prompt
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Confidence: {Math.round(warning.confidence * 100)}%
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Stay on Form
          </Button>
          <Button type="button" onClick={onProceed}>
            Go to Created Prompt
          </Button>
        </div>
      </div>
    </div>
  )
}

