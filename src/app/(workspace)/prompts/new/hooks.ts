'use client'

import { useCallback, useMemo, useState } from "react"

import type {
  CatalogId,
  CreatePromptCommand,
  CreatePromptResponseDto,
  ErrorResponseDto,
  PromptId,
  TagId,
} from "@/types"

import {
  computeContentMetrics,
  computeIsDirty,
  initialContentMetrics,
  initialDuplicateWarning,
  initialFormData,
  PROMPT_CONTENT_MAX,
  PROMPT_MAX_TAGS,
  PROMPT_SUMMARY_MAX,
  PROMPT_TITLE_MAX,
  type ContentMetricsVm,
  type CreatePromptFormErrors,
  type CreatePromptFormVm,
  type DuplicateWarningState,
} from "./view-types"

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

function validateTitle(title: string): string[] | undefined {
  const errors: string[] = []
  const trimmed = title.trim()

  if (trimmed.length === 0) {
    errors.push("Title is required.")
  } else if (trimmed.length > PROMPT_TITLE_MAX) {
    errors.push(`Title must be at most ${PROMPT_TITLE_MAX} characters.`)
  }

  return errors.length > 0 ? errors : undefined
}

function validateContent(content: string): string[] | undefined {
  const errors: string[] = []

  if (content.length === 0) {
    errors.push("Content is required.")
  } else if (content.length > PROMPT_CONTENT_MAX) {
    errors.push(`Content must be at most ${PROMPT_CONTENT_MAX.toLocaleString()} characters.`)
  }

  return errors.length > 0 ? errors : undefined
}

function validateSummary(summary: string): string[] | undefined {
  const errors: string[] = []

  if (summary.length > PROMPT_SUMMARY_MAX) {
    errors.push(`Summary must be at most ${PROMPT_SUMMARY_MAX.toLocaleString()} characters.`)
  }

  return errors.length > 0 ? errors : undefined
}

function validateTagIds(tagIds: TagId[]): string[] | undefined {
  const errors: string[] = []

  if (tagIds.length > PROMPT_MAX_TAGS) {
    errors.push(`Cannot select more than ${PROMPT_MAX_TAGS} tags.`)
  }

  return errors.length > 0 ? errors : undefined
}

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function parseErrorResponse(error: unknown): ErrorResponseDto {
  if (typeof error === "object" && error && "error" in error) {
    return error as ErrorResponseDto
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
    },
  }
}

async function createPromptApi(
  command: CreatePromptCommand,
): Promise<CreatePromptResponseDto> {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(command),
  })

  if (!response.ok) {
    const errorBody = (await response.json()) as ErrorResponseDto
    throw errorBody
  }

  return response.json() as Promise<CreatePromptResponseDto>
}

// ---------------------------------------------------------------------------
// Hook: useCreatePromptForm
// ---------------------------------------------------------------------------

export interface UseCreatePromptFormReturn {
  formData: CreatePromptFormVm
  errors: CreatePromptFormErrors
  contentMetrics: ContentMetricsVm
  isSubmitting: boolean
  isDirty: boolean
  formErrorMessage: string | undefined
  duplicateWarning: DuplicateWarningState
  setField: <K extends keyof CreatePromptFormVm>(
    field: K,
    value: CreatePromptFormVm[K],
  ) => void
  validateField: (field: keyof CreatePromptFormVm) => void
  validateForm: () => boolean
  submit: () => Promise<PromptId | null>
  closeDuplicateWarning: () => void
  clearFormError: () => void
}

export function useCreatePromptForm(): UseCreatePromptFormReturn {
  // Form data state
  const [formData, setFormData] = useState<CreatePromptFormVm>(initialFormData)

  // Validation errors state
  const [errors, setErrors] = useState<CreatePromptFormErrors>({})

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrorMessage, setFormErrorMessage] = useState<string | undefined>()

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarningState>(
    initialDuplicateWarning,
  )

  // Computed content metrics
  const contentMetrics = useMemo<ContentMetricsVm>(
    () => computeContentMetrics(formData.content),
    [formData.content],
  )

  // Dirty tracking
  const isDirty = useMemo(() => computeIsDirty(formData), [formData])

  // Field update handler
  const setField = useCallback(
    <K extends keyof CreatePromptFormVm>(
      field: K,
      value: CreatePromptFormVm[K],
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))

      // Clear field error when user starts typing
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }))

      // Clear form error message when user makes changes
      setFormErrorMessage(undefined)
    },
    [],
  )

  // Single field validation
  const validateField = useCallback(
    (field: keyof CreatePromptFormVm) => {
      let fieldErrors: string[] | undefined

      switch (field) {
        case "title":
          fieldErrors = validateTitle(formData.title)
          break
        case "content":
          fieldErrors = validateContent(formData.content)
          break
        case "summary":
          fieldErrors = validateSummary(formData.summary)
          break
        case "tagIds":
          fieldErrors = validateTagIds(formData.tagIds)
          break
        default:
          // catalogId doesn't require client-side validation
          fieldErrors = undefined
      }

      setErrors((prev) => ({
        ...prev,
        [field]: fieldErrors,
      }))
    },
    [formData],
  )

  // Full form validation
  const validateForm = useCallback((): boolean => {
    const titleErrors = validateTitle(formData.title)
    const contentErrors = validateContent(formData.content)
    const summaryErrors = validateSummary(formData.summary)
    const tagIdsErrors = validateTagIds(formData.tagIds)

    const newErrors: CreatePromptFormErrors = {
      title: titleErrors,
      content: contentErrors,
      summary: summaryErrors,
      tagIds: tagIdsErrors,
    }

    setErrors(newErrors)

    const hasErrors =
      titleErrors !== undefined ||
      contentErrors !== undefined ||
      summaryErrors !== undefined ||
      tagIdsErrors !== undefined

    return !hasErrors
  }, [formData])

  // Submit handler
  const submit = useCallback(async (): Promise<PromptId | null> => {
    // Validate form first
    const isValid = validateForm()
    if (!isValid) {
      return null
    }

    setIsSubmitting(true)
    setFormErrorMessage(undefined)

    try {
      const command: CreatePromptCommand = {
        title: formData.title.trim(),
        content: formData.content,
        catalogId: formData.catalogId,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
        summary: formData.summary.trim() || undefined,
      }

      const response = await createPromptApi(command)

      // Check for duplicate warning
      if (response.duplicateWarning) {
        setDuplicateWarning({
          isOpen: true,
          warning: response.duplicateWarning,
          createdPromptId: response.prompt.id,
        })
        setIsSubmitting(false)
        return response.prompt.id
      }

      setIsSubmitting(false)
      return response.prompt.id
    } catch (error) {
      setIsSubmitting(false)

      if (error instanceof TypeError) {
        // Network error
        setFormErrorMessage(
          "Unable to connect. Please check your connection and try again.",
        )
        return null
      }

      const errorResponse = parseErrorResponse(error)

      // Map field errors from response
      const fieldErrors = errorResponse.error.details?.fieldErrors as
        | CreatePromptFormErrors
        | undefined

      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        setFormErrorMessage(errorResponse.error.message)
      }

      return null
    }
  }, [formData, validateForm])

  // Close duplicate warning dialog
  const closeDuplicateWarning = useCallback(() => {
    setDuplicateWarning({
      isOpen: false,
      warning: null,
      createdPromptId: null,
    })
  }, [])

  // Clear form error message
  const clearFormError = useCallback(() => {
    setFormErrorMessage(undefined)
  }, [])

  return {
    formData,
    errors,
    contentMetrics,
    isSubmitting,
    isDirty,
    formErrorMessage,
    duplicateWarning,
    setField,
    validateField,
    validateForm,
    submit,
    closeDuplicateWarning,
    clearFormError,
  }
}

