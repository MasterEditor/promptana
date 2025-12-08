import type { CatalogId, PromptDuplicateWarningDto, PromptId, TagId } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROMPT_TITLE_MAX = 255
export const PROMPT_CONTENT_MAX = 100_000
export const PROMPT_CONTENT_SOFT_LIMIT = 80_000
export const PROMPT_SUMMARY_MAX = 1_000
export const PROMPT_MAX_TAGS = 50

// ---------------------------------------------------------------------------
// Form View Models
// ---------------------------------------------------------------------------

/**
 * Form data for creating a new prompt.
 */
export interface CreatePromptFormVm {
  title: string
  content: string
  catalogId: CatalogId | null
  tagIds: TagId[]
  summary: string
}

/**
 * Field-level validation errors for the create form.
 */
export interface CreatePromptFormErrors {
  title?: string[]
  content?: string[]
  catalogId?: string[]
  tagIds?: string[]
  summary?: string[]
}

/**
 * Computed content metrics for display.
 */
export interface ContentMetricsVm {
  charCount: number
  isAtLimit: boolean
  isNearLimit: boolean
}

/**
 * State for the duplicate warning dialog.
 */
export interface DuplicateWarningState {
  isOpen: boolean
  warning: PromptDuplicateWarningDto | null
  createdPromptId: PromptId | null
}

/**
 * Complete state for the create prompt view.
 */
export interface CreatePromptViewState {
  formData: CreatePromptFormVm
  errors: CreatePromptFormErrors
  contentMetrics: ContentMetricsVm
  isSubmitting: boolean
  isDirty: boolean
  formErrorMessage: string | undefined
  duplicateWarning: DuplicateWarningState
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

export const initialFormData: CreatePromptFormVm = {
  title: "",
  content: "",
  catalogId: null,
  tagIds: [],
  summary: "",
}

export const initialContentMetrics: ContentMetricsVm = {
  charCount: 0,
  isAtLimit: false,
  isNearLimit: false,
}

export const initialDuplicateWarning: DuplicateWarningState = {
  isOpen: false,
  warning: null,
  createdPromptId: null,
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Compute content metrics from content string.
 */
export function computeContentMetrics(content: string): ContentMetricsVm {
  const charCount = content.length
  const isAtLimit = charCount > PROMPT_CONTENT_MAX
  const isNearLimit = !isAtLimit && charCount >= PROMPT_CONTENT_SOFT_LIMIT

  return {
    charCount,
    isAtLimit,
    isNearLimit,
  }
}

/**
 * Check if form has been modified from initial state.
 */
export function computeIsDirty(formData: CreatePromptFormVm): boolean {
  if (formData.title.trim().length > 0) return true
  if (formData.content.length > 0) return true
  if (formData.catalogId !== null) return true
  if (formData.tagIds.length > 0) return true
  if (formData.summary.trim().length > 0) return true
  return false
}

