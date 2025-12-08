'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type {
  CatalogDto,
  CatalogId,
  CatalogListResponseDto,
  CreateCatalogCommand,
  ErrorResponseDto,
  UpdateCatalogCommand,
} from "@/types"

import {
  catalogToFormData,
  createEmptyCatalogFormData,
  mapCatalogDtoToVm,
  CATALOG_NAME_MAX_LENGTH,
  CATALOG_DESCRIPTION_MAX_LENGTH,
  type CatalogDialogState,
  type CatalogFieldErrors,
  type CatalogFormData,
  type CatalogListItemVm,
  type CatalogsListFiltersVm,
  type CatalogsViewState,
  type DeleteCatalogDialogState,
} from "./view-types"

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function buildQueryFromFilters(filters: CatalogsListFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize > 0 && filters.pageSize !== 20) {
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
// useCatalogsListFilters - Filter state with URL synchronization
// ---------------------------------------------------------------------------

export function useCatalogsListFilters(initialFilters: CatalogsListFiltersVm) {
  const router = useRouter()
  const [filters, setFilters] = useState<CatalogsListFiltersVm>(initialFilters)

  const updateFilters = useCallback(
    (partial: Partial<CatalogsListFiltersVm>) => {
      setFilters((prev) => {
        const next: CatalogsListFiltersVm = {
          ...prev,
          ...partial,
        }

        // Reset page to 1 when search changes
        const shouldResetPage = partial.search !== undefined

        if (shouldResetPage && partial.page === undefined) {
          next.page = 1
        }

        const query = buildQueryFromFilters(next)
        const href = query.length > 0 ? `/catalogs?${query}` : "/catalogs"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: CatalogsListFiltersVm = {
        ...prev,
        search: "",
        page: 1,
      }

      router.replace("/catalogs", { scroll: false })

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
// useCatalogsListData - Catalog list data fetching
// ---------------------------------------------------------------------------

export function useCatalogsListData(filters: CatalogsListFiltersVm) {
  const [state, setState] = useState<CatalogsViewState>(() => ({
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
        const url = `/api/catalogs${queryString ? `?${queryString}` : ""}`

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
              message: "Failed to load catalogs.",
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

        const data = (await response.json()) as CatalogListResponseDto

        if (!abortController.signal.aborted) {
          const items: CatalogListItemVm[] = data.items.map((item) =>
            mapCatalogDtoToVm(item),
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
// useCatalogDialog - Create/Edit dialog state and operations
// ---------------------------------------------------------------------------

function createInitialDialogState(): CatalogDialogState {
  return {
    open: false,
    mode: "create",
    catalogId: null,
    formData: createEmptyCatalogFormData(),
    isSubmitting: false,
    fieldErrors: {},
    formError: null,
  }
}

export function useCatalogDialog(onSuccess: () => void) {
  const [state, setState] = useState<CatalogDialogState>(createInitialDialogState)

  const openCreate = useCallback(() => {
    setState({
      open: true,
      mode: "create",
      catalogId: null,
      formData: createEmptyCatalogFormData(),
      isSubmitting: false,
      fieldErrors: {},
      formError: null,
    })
  }, [])

  const openEdit = useCallback((catalog: CatalogListItemVm) => {
    setState({
      open: true,
      mode: "edit",
      catalogId: catalog.id,
      formData: catalogToFormData(catalog),
      isSubmitting: false,
      fieldErrors: {},
      formError: null,
    })
  }, [])

  const close = useCallback(() => {
    setState(createInitialDialogState())
  }, [])

  const setFormField = useCallback(
    (field: keyof CatalogFormData, value: string) => {
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
    (formData: CatalogFormData): CatalogFieldErrors => {
      const errors: CatalogFieldErrors = {}

      const trimmedName = formData.name.trim()
      if (trimmedName.length === 0) {
        errors.name = ["Name is required."]
      } else if (trimmedName.length > CATALOG_NAME_MAX_LENGTH) {
        errors.name = [`Name must be at most ${CATALOG_NAME_MAX_LENGTH} characters.`]
      }

      if (formData.description.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
        errors.description = [
          `Description must be at most ${CATALOG_DESCRIPTION_MAX_LENGTH} characters.`,
        ]
      }

      return errors
    },
    [],
  )

  const submit = useCallback(async () => {
    const { mode, catalogId, formData } = state

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
      const trimmedDescription = formData.description.trim()

      if (mode === "create") {
        const command: CreateCatalogCommand = {
          name: trimmedName,
          description: trimmedDescription || null,
        }

        const response = await fetch("/api/catalogs", {
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
        if (!catalogId) return

        const command: UpdateCatalogCommand = {
          name: trimmedName,
          description: trimmedDescription || null,
        }

        const response = await fetch(`/api/catalogs/${encodeURIComponent(catalogId)}`, {
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
          message: "Failed to save catalog.",
        },
      }

      // Handle field errors from API
      const apiFieldErrors = (error.error.details?.fieldErrors ?? {}) as CatalogFieldErrors

      // Handle 409 CONFLICT for duplicate names
      if (error.error.code === "CONFLICT") {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          formError: "A catalog with this name already exists.",
        }))
        return
      }

      // Handle 404 NOT_FOUND for edit mode
      if (error.error.code === "NOT_FOUND") {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          formError: "Catalog not found. It may have been deleted.",
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
// useDeleteCatalogDialog - Delete confirmation dialog
// ---------------------------------------------------------------------------

export function useDeleteCatalogDialog(onSuccess: () => void) {
  const [state, setState] = useState<DeleteCatalogDialogState>({
    open: false,
    catalog: null,
    isDeleting: false,
  })

  const open = useCallback((catalog: CatalogListItemVm) => {
    setState({
      open: true,
      catalog,
      isDeleting: false,
    })
  }, [])

  const close = useCallback(() => {
    setState({
      open: false,
      catalog: null,
      isDeleting: false,
    })
  }, [])

  const confirm = useCallback(async () => {
    const { catalog } = state
    if (!catalog) return

    setState((prev) => ({
      ...prev,
      isDeleting: true,
    }))

    try {
      const response = await fetch(`/api/catalogs/${encodeURIComponent(catalog.id)}`, {
        method: "DELETE",
      })

      if (!response.ok && response.status !== 204) {
        let body: ErrorResponseDto | null = null
        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        // Even on 404, we consider it a success (catalog is already gone)
        if (response.status !== 404) {
          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to delete catalog.",
            },
          }

          setState((prev) => ({
            ...prev,
            isDeleting: false,
          }))

          // Could show error via toast/global message here
          console.error("[useDeleteCatalogDialog] delete failed", error)
          return
        }
      }

      // Success
      close()
      onSuccess()
    } catch (err) {
      console.error("[useDeleteCatalogDialog] delete failed", err)
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

