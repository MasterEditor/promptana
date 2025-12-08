'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type {
  TagDto,
  TagId,
  TagListResponseDto,
  CreateTagCommand,
  ErrorResponseDto,
  UpdateTagCommand,
} from "@/types"

import {
  tagToFormData,
  createEmptyTagFormData,
  mapTagDtoToVm,
  TAG_NAME_MAX_LENGTH,
  type TagDialogState,
  type TagFieldErrors,
  type TagFormData,
  type TagListItemVm,
  type TagsListFiltersVm,
  type TagsViewState,
  type DeleteTagDialogState,
} from "./view-types"

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function buildQueryFromFilters(filters: TagsListFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize > 0 && filters.pageSize !== 50) {
    params.set("pageSize", String(filters.pageSize))
  }

  const search = filters.search.trim()
  if (search.length > 0) {
    params.set("search", search)
  }

  return params.toString()
}

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

// ---------------------------------------------------------------------------
// useTagsListFilters - Filter state with URL synchronization
// ---------------------------------------------------------------------------

export function useTagsListFilters(initialFilters: TagsListFiltersVm) {
  const router = useRouter()
  const [filters, setFilters] = useState<TagsListFiltersVm>(initialFilters)

  const updateFilters = useCallback(
    (partial: Partial<TagsListFiltersVm>) => {
      setFilters((prev) => {
        const next: TagsListFiltersVm = {
          ...prev,
          ...partial,
        }

        // Reset page to 1 when search changes
        const shouldResetPage = partial.search !== undefined

        if (shouldResetPage && partial.page === undefined) {
          next.page = 1
        }

        const query = buildQueryFromFilters(next)
        const href = query.length > 0 ? `/tags?${query}` : "/tags"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: TagsListFiltersVm = {
        ...prev,
        search: "",
        page: 1,
      }

      router.replace("/tags", { scroll: false })

      return next
    })
  }, [router])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

// ---------------------------------------------------------------------------
// useTagsListData - Tag list data fetching
// ---------------------------------------------------------------------------

export function useTagsListData(filters: TagsListFiltersVm) {
  const [state, setState] = useState<TagsViewState>(() => ({
    items: [],
    page: filters.page,
    pageSize: filters.pageSize,
    total: 0,
    isLoading: true,
    isInitialLoad: true,
    error: null,
  }))
  const [reloadCounter, setReloadCounter] = useState(0)

  const queryString = useMemo(() => buildQueryFromFilters(filters), [filters])

  useEffect(() => {
    const abortController = new AbortController()

    async function load() {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))

      try {
        const url = `/api/tags${queryString ? `?${queryString}` : ""}`

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          let body: ErrorResponseDto | null = null

          try {
            body = (await response.json()) as ErrorResponseDto
          } catch {
            // ignore JSON parse failure
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load tags.",
            },
          }

          if (!abortController.signal.aborted) {
            setState((prev) => ({
              ...prev,
              items: [],
              total: 0,
              page: filters.page,
              pageSize: filters.pageSize,
              isLoading: false,
              isInitialLoad: false,
              error,
            }))
          }

          return
        }

        const data = (await response.json()) as TagListResponseDto

        if (!abortController.signal.aborted) {
          const items: TagListItemVm[] = data.items.map((item) =>
            mapTagDtoToVm(item),
          )

          setState({
            items,
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            isLoading: false,
            isInitialLoad: false,
            error: null,
          })
        }
      } catch (err) {
        if (abortController.signal.aborted) return

        const error = parseErrorResponse(err)

        setState((prev) => ({
          ...prev,
          items: [],
          total: 0,
          page: filters.page,
          pageSize: filters.pageSize,
          isLoading: false,
          isInitialLoad: false,
          error,
        }))
      }
    }

    void load()

    return () => {
      abortController.abort()
    }
  }, [filters, queryString, reloadCounter])

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1)
  }, [])

  return { state, reload }
}

// ---------------------------------------------------------------------------
// useTagDialog - Create/Edit dialog state and operations
// ---------------------------------------------------------------------------

function createInitialDialogState(): TagDialogState {
  return {
    open: false,
    mode: "create",
    tagId: null,
    formData: createEmptyTagFormData(),
    isSubmitting: false,
    fieldErrors: {},
    formError: null,
  }
}

export function useTagDialog(onSuccess: () => void) {
  const [state, setState] = useState<TagDialogState>(createInitialDialogState)

  const openCreate = useCallback(() => {
    setState({
      open: true,
      mode: "create",
      tagId: null,
      formData: createEmptyTagFormData(),
      isSubmitting: false,
      fieldErrors: {},
      formError: null,
    })
  }, [])

  const openEdit = useCallback((tag: TagListItemVm) => {
    setState({
      open: true,
      mode: "edit",
      tagId: tag.id,
      formData: tagToFormData(tag),
      isSubmitting: false,
      fieldErrors: {},
      formError: null,
    })
  }, [])

  const close = useCallback(() => {
    setState(createInitialDialogState())
  }, [])

  const setFormField = useCallback(
    (field: keyof TagFormData, value: string) => {
      setState((prev) => ({
        ...prev,
        formData: {
          ...prev.formData,
          [field]: value,
        },
        fieldErrors: {
          ...prev.fieldErrors,
          [field]: undefined,
        },
        formError: null,
      }))
    },
    [],
  )

  const validateForm = useCallback(
    (formData: TagFormData): TagFieldErrors => {
      const errors: TagFieldErrors = {}

      const trimmedName = formData.name.trim()
      if (trimmedName.length === 0) {
        errors.name = ["Name is required."]
      } else if (trimmedName.length > TAG_NAME_MAX_LENGTH) {
        errors.name = [`Name must be at most ${TAG_NAME_MAX_LENGTH} characters.`]
      }

      return errors
    },
    [],
  )

  const submit = useCallback(async () => {
    const { mode, tagId, formData } = state

    // Client-side validation
    const fieldErrors = validateForm(formData)
    if (Object.keys(fieldErrors).length > 0) {
      setState((prev) => ({
        ...prev,
        fieldErrors,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      fieldErrors: {},
      formError: null,
    }))

    try {
      const trimmedName = formData.name.trim()

      if (mode === "create") {
        const command: CreateTagCommand = {
          name: trimmedName,
        }

        const response = await fetch("/api/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(command),
        })

        if (!response.ok) {
          await handleApiError(response)
          return
        }

        // Success
        close()
        onSuccess()
      } else {
        // Edit mode
        if (!tagId) return

        const command: UpdateTagCommand = {
          name: trimmedName,
        }

        const response = await fetch(`/api/tags/${encodeURIComponent(tagId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(command),
        })

        if (!response.ok) {
          await handleApiError(response)
          return
        }

        // Success
        close()
        onSuccess()
      }
    } catch (err) {
      const error = parseErrorResponse(err)
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        formError: error.error.message,
      }))
    }

    async function handleApiError(response: Response) {
      let body: ErrorResponseDto | null = null
      try {
        body = (await response.json()) as ErrorResponseDto
      } catch {
        // ignore
      }

      const error = body ?? {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save tag.",
        },
      }

      // Handle field errors from API
      const apiFieldErrors = (error.error.details?.fieldErrors ?? {}) as TagFieldErrors

      // Handle 409 CONFLICT for duplicate names
      if (error.error.code === "CONFLICT") {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          formError: "A tag with this name already exists.",
        }))
        return
      }

      // Handle 404 NOT_FOUND for edit mode
      if (error.error.code === "NOT_FOUND") {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          formError: "Tag not found. It may have been deleted.",
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        fieldErrors: Object.keys(apiFieldErrors).length > 0 ? apiFieldErrors : prev.fieldErrors,
        formError: Object.keys(apiFieldErrors).length === 0 ? error.error.message : null,
      }))
    }
  }, [state, validateForm, close, onSuccess])

  return {
    state,
    openCreate,
    openEdit,
    close,
    setFormField,
    submit,
  }
}

// ---------------------------------------------------------------------------
// useDeleteTagDialog - Delete confirmation dialog
// ---------------------------------------------------------------------------

export function useDeleteTagDialog(onSuccess: () => void) {
  const [state, setState] = useState<DeleteTagDialogState>({
    open: false,
    tag: null,
    isDeleting: false,
  })

  const open = useCallback((tag: TagListItemVm) => {
    setState({
      open: true,
      tag,
      isDeleting: false,
    })
  }, [])

  const close = useCallback(() => {
    setState({
      open: false,
      tag: null,
      isDeleting: false,
    })
  }, [])

  const confirm = useCallback(async () => {
    const { tag } = state
    if (!tag) return

    setState((prev) => ({
      ...prev,
      isDeleting: true,
    }))

    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(tag.id)}`, {
        method: "DELETE",
      })

      if (!response.ok && response.status !== 204) {
        let body: ErrorResponseDto | null = null
        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        // Even on 404, we consider it a success (tag is already gone)
        if (response.status !== 404) {
          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to delete tag.",
            },
          }

          setState((prev) => ({
            ...prev,
            isDeleting: false,
          }))

          // Could show error via toast/global message here
          console.error("[useDeleteTagDialog] delete failed", error)
          return
        }
      }

      // Success
      close()
      onSuccess()
    } catch (err) {
      console.error("[useDeleteTagDialog] delete failed", err)
      setState((prev) => ({
        ...prev,
        isDeleting: false,
      }))
    }
  }, [state, close, onSuccess])

  return {
    state,
    open,
    close,
    confirm,
  }
}

