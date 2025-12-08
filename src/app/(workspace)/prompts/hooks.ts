'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import type {
  CatalogId,
  CatalogListResponseDto,
  CreatePromptVersionCommand,
  CreatePromptVersionResponseDto,
  DeletePromptCommand,
  ErrorResponseDto,
  ImprovePromptCommand,
  ImprovePromptResponseDto,
  PromptId,
  PromptListResponseDto,
  PromptDetailDto,
  PromptVersionDto,
  PromptVersionId,
  PromptVersionListResponseDto,
  RestorePromptVersionCommand,
  RestorePromptVersionResponseDto,
  RunDto,
  RunId,
  RunListResponseDto,
  RunStatus,
  TagId,
  TagListResponseDto,
  CreateRunCommand,
  CreateRunResponseDto,
} from "@/types"

import {
  mapPromptListItemDtoToVm,
  mapRunListItemDtoToVm,
  mapRunDtoToDetailVm,
  mapVersionStubDtoToVm,
  mapVersionDtoToDetailVm,
  type PromptDensityMode,
  type PromptFiltersOptionsVm,
  type PromptListFiltersVm,
  type PromptListItemVm,
  type PromptListSort,
  type PromptsViewState,
  type ImproveSuggestionVm,
  type ImproveSuggestionsVm,
  type PromptDetailEditorState,
  type PromptDetailViewState,
  type PromptDetailVm,
  type UnsavedChangesVm,
  type RunsFiltersVm,
  type RunsViewState,
  type RunListItemVm,
  type RunDetailPanelState,
  type RunDetailVm,
  type VersionsFiltersVm,
  type VersionsViewState,
  type VersionListItemVm,
  type VersionDetailPanelState,
  type VersionDetailVm,
  PROMPT_CONTENT_MAX,
  PROMPT_CONTENT_SOFT_LIMIT,
  mapPromptDetailDtoToVm,
} from "./view-types"

function buildQueryFromFilters(filters: PromptListFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize > 0) {
    params.set("pageSize", String(filters.pageSize))
  }

  const search = filters.search.trim()
  if (search.length > 0) {
    params.set("search", search)
  }

  if (filters.tagIds.length > 0) {
    params.set("tagIds", filters.tagIds.join(","))
  }

  if (filters.catalogId) {
    params.set("catalogId", filters.catalogId)
  }

  if (filters.sort) {
    params.set("sort", filters.sort)
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

/**
 * Parse filters from URL search params for prompts list
 */
function parsePromptFiltersFromSearchParams(
  searchParams: URLSearchParams,
  defaults: { pageSize: number },
): PromptListFiltersVm {
  const search = searchParams.get("search") ?? ""
  const tagIdsRaw = searchParams.get("tagIds") ?? ""
  const tagIds = tagIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as TagId[]
  const catalogIdRaw = searchParams.get("catalogId")
  const catalogId = catalogIdRaw && catalogIdRaw.trim().length > 0
    ? (catalogIdRaw.trim() as CatalogId)
    : null
  const sortRaw = searchParams.get("sort")
  const allowedSorts: PromptListSort[] = [
    "updatedAtDesc",
    "createdAtDesc",
    "titleAsc",
    "lastRunDesc",
    "relevance",
  ]
  const sort = allowedSorts.includes(sortRaw as PromptListSort)
    ? (sortRaw as PromptListSort)
    : "updatedAtDesc"
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10)
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSizeRaw = parseInt(
    searchParams.get("pageSize") ?? String(defaults.pageSize),
    10,
  )
  const pageSize = Number.isNaN(pageSizeRaw) || pageSizeRaw < 1 || pageSizeRaw > 100
    ? defaults.pageSize
    : pageSizeRaw

  return { search, tagIds, catalogId, sort, page, pageSize }
}

export function usePromptListFilters(initialFilters: PromptListFiltersVm) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<PromptListFiltersVm>(initialFilters)

  // Sync filters from URL when searchParams change externally
  useEffect(() => {
    const parsed = parsePromptFiltersFromSearchParams(searchParams, {
      pageSize: initialFilters.pageSize,
    })
    setFilters(parsed)
  }, [searchParams, initialFilters.pageSize])

  const updateFilters = useCallback(
    (partial: Partial<PromptListFiltersVm>) => {
      setFilters((prev) => {
        const next: PromptListFiltersVm = {
          ...prev,
          ...partial,
        }

        const shouldResetPage =
          partial.search !== undefined ||
          partial.sort !== undefined ||
          partial.catalogId !== undefined ||
          partial.tagIds !== undefined

        if (shouldResetPage) {
          next.page = 1
        }

        const query = buildQueryFromFilters(next)
        const href = query.length > 0 ? `/prompts?${query}` : "/prompts"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: PromptListFiltersVm = {
        ...prev,
        search: "",
        tagIds: [],
        catalogId: null,
        sort: "updatedAtDesc",
        page: 1,
      }

      const query = buildQueryFromFilters(next)
      const href = query.length > 0 ? `/prompts?${query}` : "/prompts"

      router.replace(href, { scroll: false })

      return next
    })
  }, [router])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

export function usePromptListData(filters: PromptListFiltersVm) {
  const [state, setState] = useState<PromptsViewState>(() => ({
    items: [],
    page: filters.page,
    pageSize: filters.pageSize,
    total: 0,
    isLoading: true,
    isInitialLoad: true,
    error: null,
  }))
  const [reloadCounter, setReloadCounter] = useState(0)

  const query = useMemo(() => buildQueryFromFilters(filters), [filters])

  useEffect(() => {
    const abortController = new AbortController()

    async function load() {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))

      try {
        const response = await fetch(`/api/prompts?${query}`, {
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
            // ignore JSON parse failure; fall back to generic error
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load prompts.",
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

        const data = (await response.json()) as PromptListResponseDto

        if (!abortController.signal.aborted) {
          const items: PromptListItemVm[] = data.items.map((item) =>
            mapPromptListItemDtoToVm(item),
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
  }, [filters, query, reloadCounter])

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1)
  }, [])

  return { state, reload }
}

export function usePromptFiltersOptions() {
  const [options, setOptions] = useState<PromptFiltersOptionsVm>({
    availableTags: [],
    availableCatalogs: [],
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<ErrorResponseDto | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [tagsResponse, catalogsResponse] = await Promise.all([
        fetch("/api/tags?page=1&pageSize=200", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
        fetch("/api/catalogs?page=1&pageSize=100", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
      ])

      if (!tagsResponse.ok || !catalogsResponse.ok) {
        let body: ErrorResponseDto | null = null

        try {
          body = (await (tagsResponse.ok
            ? catalogsResponse.json()
            : tagsResponse.json())) as ErrorResponseDto
        } catch {
          // ignore JSON parse failure
        }

        setOptions({
          availableTags: [],
          availableCatalogs: [],
        })

        setError(
          body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load filter options.",
            },
          },
        )

        return
      }

      const tagsJson = (await tagsResponse.json()) as TagListResponseDto
      const catalogsJson =
        (await catalogsResponse.json()) as CatalogListResponseDto

      setOptions({
        availableTags: tagsJson.items,
        availableCatalogs: catalogsJson.items,
      })
      setError(null)
    } catch (err) {
      setOptions({
        availableTags: [],
        availableCatalogs: [],
      })
      setError(parseErrorResponse(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    options,
    isLoading,
    error,
    refresh,
  }
}

export function getInitialDensity(): PromptDensityMode {
  if (typeof window === "undefined") {
    return "comfortable"
  }

  const stored = window.localStorage.getItem("promptListDensity") as
    | PromptDensityMode
    | null

  if (stored === "compact" || stored === "comfortable") {
    return stored
  }

  return "comfortable"
}

export function setDensityPreference(mode: PromptDensityMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem("promptListDensity", mode)
}

// ---------------------------------------------------------------------------
// Shared hooks for offline status and prompt detail view
// ---------------------------------------------------------------------------

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false
    }
    return !navigator.onLine
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    function handleOnline() {
      setIsOffline(false)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOffline
}

function createEmptyEditorState(): PromptDetailEditorState {
  return {
    draftTitle: "",
    draftCatalogId: null,
    draftTagIds: [],
    draftContent: "",
    draftSummary: "",
    contentCharCount: 0,
    contentAtLimit: false,
    contentNearLimit: false,
    isDirty: false,
    isSavingVersion: false,
    isSavingMetadataOnly: false,
    fieldErrors: {},
    formErrorMessage: undefined,
  }
}

function buildEditorFromPrompt(prompt: PromptDetailVm): PromptDetailEditorState {
  const draftContent = prompt.content
  const contentCharCount = draftContent.length
  const contentAtLimit = contentCharCount > PROMPT_CONTENT_MAX
  const contentNearLimit =
    !contentAtLimit && contentCharCount >= PROMPT_CONTENT_SOFT_LIMIT

  return {
    draftTitle: prompt.title,
    draftCatalogId: prompt.catalogId,
    draftTagIds: prompt.tags.map((tag) => tag.id),
    draftContent,
    draftSummary: prompt.summary ?? "",
    contentCharCount,
    contentAtLimit,
    contentNearLimit,
    isDirty: false,
    isSavingVersion: false,
    isSavingMetadataOnly: false,
    fieldErrors: {},
    formErrorMessage: undefined,
  }
}

function computeIsDirty(
  editor: PromptDetailEditorState,
  prompt: PromptDetailVm | null,
): boolean {
  if (!prompt) return false

  if (editor.draftTitle !== prompt.title) return true
  if (editor.draftCatalogId !== prompt.catalogId) return true

  const promptTagIds = prompt.tags.map((tag) => tag.id)
  if (promptTagIds.length !== editor.draftTagIds.length) return true
  for (let i = 0; i < promptTagIds.length; i += 1) {
    if (promptTagIds[i] !== editor.draftTagIds[i]) return true
  }

  if (editor.draftContent !== prompt.content) return true

  const promptSummary = prompt.summary ?? ""
  if (editor.draftSummary !== promptSummary) return true

  return false
}

export function usePromptDetailOverview(promptId: PromptId) {
  const router = useRouter()

  const [state, setState] = useState<PromptDetailViewState>(() => ({
    prompt: null,
    editor: createEmptyEditorState(),
    isLoadingInitial: true,
    isReloading: false,
    error: null,
    isRunning: false,
    isImproving: false,
    isDeleting: false,
    isCopying: false,
    unsavedChanges: {
      isOpen: false,
      nextAction: null,
      nextActionPayload: undefined,
      message: "",
    },
    isOffline: false,
  }))

  const load = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isReloading: !prev.isLoadingInitial,
      error: null,
    }))

    try {
      const response = await fetch(
        `/api/prompts/${encodeURIComponent(promptId)}` +
          "?includeVersions=false&includeRuns=false",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      )

      if (!response.ok) {
        let body: ErrorResponseDto | null = null

        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        const error = body ?? {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to load prompt.",
          },
        }

        setState((prev) => ({
          ...prev,
          prompt: null,
          editor: createEmptyEditorState(),
          isLoadingInitial: false,
          isReloading: false,
          error,
        }))

        return
      }

      const data = (await response.json()) as PromptDetailDto
      const promptVm = mapPromptDetailDtoToVm(data)
      const editor = buildEditorFromPrompt(promptVm)

      setState((prev) => ({
        ...prev,
        prompt: promptVm,
        editor,
        isLoadingInitial: false,
        isReloading: false,
        error: null,
      }))
    } catch (err) {
      const error = parseErrorResponse(err)
      setState((prev) => ({
        ...prev,
        prompt: null,
        editor: createEmptyEditorState(),
        isLoadingInitial: false,
        isReloading: false,
        error,
      }))
    }
  }, [promptId])

  useEffect(() => {
    void load()
  }, [load])

  const updateEditor = useCallback(
    (updater: (current: PromptDetailEditorState) => PromptDetailEditorState) => {
      setState((prev) => {
        const nextEditor = updater(prev.editor)
        const isDirty = computeIsDirty(nextEditor, prev.prompt)
        return {
          ...prev,
          editor: {
            ...nextEditor,
            isDirty,
          },
        }
      })
    },
    [],
  )

  const setDraftTitle = useCallback(
    (title: string) => {
      updateEditor((current) => ({
        ...current,
        draftTitle: title,
        fieldErrors: { ...current.fieldErrors, title: undefined },
      }))
    },
    [updateEditor],
  )

  const setDraftCatalog = useCallback(
    (catalogId: CatalogId | null) => {
      updateEditor((current) => ({
        ...current,
        draftCatalogId: catalogId,
        fieldErrors: { ...current.fieldErrors, catalogId: undefined },
      }))
    },
    [updateEditor],
  )

  const setDraftTags = useCallback(
    (tagIds: string[]) => {
      updateEditor((current) => ({
        ...current,
        draftTagIds: tagIds,
        fieldErrors: { ...current.fieldErrors, tagIds: undefined },
      }))
    },
    [updateEditor],
  )

  const setDraftContent = useCallback(
    (content: string) => {
      updateEditor((current) => {
        const contentCharCount = content.length
        const contentAtLimit = contentCharCount > PROMPT_CONTENT_MAX
        const contentNearLimit =
          !contentAtLimit && contentCharCount >= PROMPT_CONTENT_SOFT_LIMIT

        return {
          ...current,
          draftContent: content,
          contentCharCount,
          contentAtLimit,
          contentNearLimit,
          fieldErrors: { ...current.fieldErrors, content: undefined },
        }
      })
    },
    [updateEditor],
  )

  const setDraftSummary = useCallback(
    (summary: string) => {
      updateEditor((current) => ({
        ...current,
        draftSummary: summary,
        fieldErrors: { ...current.fieldErrors, summary: undefined },
      }))
    },
    [updateEditor],
  )

  const savePrompt = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      editor: {
        ...prev.editor,
        isSavingVersion: true,
        isSavingMetadataOnly: true,
        formErrorMessage: undefined,
        fieldErrors: {},
      },
    }))

    try {
      // Basic client-side validation for title/content length.
      let validationErrors: PromptDetailEditorState["fieldErrors"] = {}

      const current = state.prompt
      const editor = state.editor

      if (!current) {
        return
      }

      if (editor.draftTitle.trim().length === 0) {
        validationErrors = {
          ...validationErrors,
          title: ["Title is required."],
        }
      }

      if (editor.contentAtLimit) {
        validationErrors = {
          ...validationErrors,
          content: [
            `Content exceeds maximum length of ${PROMPT_CONTENT_MAX.toLocaleString()} characters.`,
          ],
        }
      }

      if (Object.keys(validationErrors).length > 0) {
        setState((prev) => ({
          ...prev,
          editor: {
            ...prev.editor,
            fieldErrors: validationErrors,
            isSavingVersion: false,
            isSavingMetadataOnly: false,
          },
        }))
        return
      }

      // Decide whether content/title/summary changed and thus require a new version.
      const hasVersionChanges =
        editor.draftContent !== current.content ||
        editor.draftTitle !== current.title ||
        editor.draftSummary !== (current.summary ?? "")

      const metadataTagIds = current.tags.map((tag) => tag.id)

      const hasMetadataChanges =
        editor.draftTitle !== current.title ||
        editor.draftCatalogId !== current.catalogId ||
        editor.draftTagIds.length !== metadataTagIds.length ||
        editor.draftTagIds.some((id, index) => id !== metadataTagIds[index])

      // If there are content changes, create a new version first.
      if (hasVersionChanges) {
        const command: CreatePromptVersionCommand = {
          title: editor.draftTitle,
          content: editor.draftContent,
          summary: editor.draftSummary || undefined,
          source: "manual",
          baseVersionId: current.currentVersionId ?? null,
        }

        const response = await fetch(
          `/api/prompts/${encodeURIComponent(current.id)}/versions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(command),
          },
        )

        if (!response.ok) {
          let body: ErrorResponseDto | null = null
          try {
            body = (await response.json()) as ErrorResponseDto
          } catch {
            // ignore
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to save prompt version.",
            },
          }

          const fieldErrors = (error.error.details?.fieldErrors ??
            {}) as PromptDetailEditorState["fieldErrors"]

          setState((prev) => ({
            ...prev,
            editor: {
              ...prev.editor,
              fieldErrors,
              formErrorMessage: fieldErrors ? undefined : error.error.message,
              isSavingVersion: false,
              isSavingMetadataOnly: false,
            },
          }))

          return
        }

        // We do not need the response body for now; a subsequent reload will
        // refresh the prompt state.
        await response.json() as CreatePromptVersionResponseDto
      }

      // If there are metadata-only changes, update the prompt metadata.
      if (hasMetadataChanges) {
        const metadataPayload = {
          title: editor.draftTitle,
          catalogId: editor.draftCatalogId,
          tagIds: editor.draftTagIds,
        }

        const response = await fetch(
          `/api/prompts/${encodeURIComponent(current.id)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(metadataPayload),
          },
        )

        if (!response.ok) {
          let body: ErrorResponseDto | null = null
          try {
            body = (await response.json()) as ErrorResponseDto
          } catch {
            // ignore
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to update prompt metadata.",
            },
          }

          const fieldErrors = (error.error.details?.fieldErrors ??
            {}) as PromptDetailEditorState["fieldErrors"]

          setState((prev) => ({
            ...prev,
            editor: {
              ...prev.editor,
              fieldErrors,
              formErrorMessage: fieldErrors ? undefined : error.error.message,
              isSavingVersion: false,
              isSavingMetadataOnly: false,
            },
          }))

          return
        }

        await response.json() // Updated PromptDetailDto; we'll refresh separately.
      }

      // Finally, reload prompt detail to sync state with backend.
      await load()

      setState((prev) => ({
        ...prev,
        editor: {
          ...prev.editor,
          isSavingVersion: false,
          isSavingMetadataOnly: false,
        },
      }))
    } catch (err) {
      const error = parseErrorResponse(err)
      setState((prev) => ({
        ...prev,
        editor: {
          ...prev.editor,
          formErrorMessage: error.error.message,
          isSavingVersion: false,
          isSavingMetadataOnly: false,
        },
      }))
    }
  }, [load, state])

  const deletePrompt = useCallback(async () => {
    const current = state.prompt
    if (!current) return

    setState((prev) => ({
      ...prev,
      isDeleting: true,
    }))

    try {
      const payload: DeletePromptCommand = {
        confirm: true,
      }

      const response = await fetch(
        `/api/prompts/${encodeURIComponent(current.id)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        let body: ErrorResponseDto | null = null
        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        const error = body ?? {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete prompt.",
          },
        }

        setState((prev) => ({
          ...prev,
          isDeleting: false,
          editor: {
            ...prev.editor,
            formErrorMessage: error.error.message,
          },
        }))

        return
      }

      // Navigate back to the prompts list after successful deletion.
      router.push("/prompts")
    } catch (err) {
      const error = parseErrorResponse(err)
      setState((prev) => ({
        ...prev,
        isDeleting: false,
        editor: {
          ...prev.editor,
          formErrorMessage: error.error.message,
        },
      }))
    }
  }, [router, state.prompt])

  const openUnsavedChangesDialog = useCallback(
    (nextAction: UnsavedChangesVm["nextAction"], payload?: unknown) => {
      setState((prev) => ({
        ...prev,
        unsavedChanges: {
          isOpen: true,
          nextAction,
          nextActionPayload: payload,
          message:
            "You have unsaved changes. What would you like to do before continuing?",
        },
      }))
    },
    [],
  )

  const closeUnsavedChangesDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      unsavedChanges: {
        ...prev.unsavedChanges,
        isOpen: false,
        nextAction: null,
        nextActionPayload: undefined,
      },
    }))
  }, [])

  // The decision-handling function is intentionally minimal for now. The
  // consumer is expected to call savePrompt or perform navigation/run/improve
  // after examining the nextAction/nextActionPayload values.
  const applyUnsavedChangesDecision = useCallback(
    (updater: (current: UnsavedChangesVm) => UnsavedChangesVm) => {
      setState((prev) => ({
        ...prev,
        unsavedChanges: updater(prev.unsavedChanges),
      }))
    },
    [],
  )

  return {
    state,
    reloadPrompt: load,
    setDraftTitle,
    setDraftCatalog,
    setDraftTags,
    setDraftContent,
    setDraftSummary,
    savePrompt,
    deletePrompt,
    openUnsavedChangesDialog,
    closeUnsavedChangesDialog,
    applyUnsavedChangesDecision,
  }
}

export function useRunPrompt(
  promptId: PromptId,
  getCurrentPromptContent: () => string,
) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<ErrorResponseDto | null>(null)

  const runPrompt = useCallback(async () => {
    setIsRunning(true)
    setError(null)

    try {
      const command: CreateRunCommand = {
        model: "openrouter/auto",
        input: {
          variables: {},
          overridePrompt: getCurrentPromptContent(),
        },
      }

      const response = await fetch(
        `/api/prompts/${encodeURIComponent(promptId)}/runs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(command),
        },
      )

      if (!response.ok) {
        let body: ErrorResponseDto | null = null
        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        const parsed = body ?? {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to run prompt.",
          },
        }

        setError(parsed)
        setIsRunning(false)
        return null
      }

      const data = (await response.json()) as CreateRunResponseDto
      setIsRunning(false)
      setError(null)
      return data.run
    } catch (err) {
      const parsed = parseErrorResponse(err)
      setError(parsed)
      setIsRunning(false)
      return null
    }
  }, [getCurrentPromptContent, promptId])

  return {
    isRunning,
    error,
    runPrompt,
  }
}

export function useImprovePrompt(
  promptId: PromptId,
  getCurrentPromptContent: () => string,
) {
  const [state, setState] = useState<ImproveSuggestionsVm>(() => ({
    isOpen: false,
    isLoading: false,
    error: null,
    selectedSuggestionId: null,
    suggestions: [],
  }))

  const startImprove = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      isLoading: true,
      error: null,
      suggestions: [],
      selectedSuggestionId: null,
    }))

    try {
      const command: ImprovePromptCommand = {
        model: "openrouter/auto",
        input: {
          currentPrompt: getCurrentPromptContent(),
        },
      }

      const response = await fetch(
        `/api/prompts/${encodeURIComponent(promptId)}/improve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(command),
        },
      )

      if (!response.ok) {
        let body: ErrorResponseDto | null = null
        try {
          body = (await response.json()) as ErrorResponseDto
        } catch {
          // ignore
        }

        const error = body ?? {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to improve prompt.",
          },
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }))

        return
      }

      const data = (await response.json()) as ImprovePromptResponseDto

      const suggestions: ImproveSuggestionVm[] = data.suggestions.map(
        (suggestion, index) => ({
          id: suggestion.id || String(index),
          model: suggestion.model,
          title: suggestion.title,
          content: suggestion.content,
          summary: suggestion.summary ?? null,
          tokenUsageLabel: suggestion.tokenUsage
            ? `${suggestion.tokenUsage.totalTokens ?? suggestion.tokenUsage.outputTokens} tokens`
            : undefined,
          isSelected: index === 0,
          isEditing: false,
          editedTitle: suggestion.title,
          editedContent: suggestion.content,
          editedSummary: suggestion.summary ?? "",
        }),
      )

      setState({
        isOpen: true,
        isLoading: false,
        error: null,
        selectedSuggestionId: suggestions[0]?.id ?? null,
        suggestions,
      })
    } catch (err) {
      const error = parseErrorResponse(err)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }))
    }
  }, [getCurrentPromptContent, promptId])

  const closePanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

  const selectSuggestion = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedSuggestionId: id,
      suggestions: prev.suggestions.map((s) => ({
        ...s,
        isSelected: s.id === id,
      })),
    }))
  }, [])

  const changeSuggestionDraft = useCallback(
    (id: string, changes: Partial<ImproveSuggestionVm>) => {
      setState((prev) => ({
        ...prev,
        suggestions: prev.suggestions.map((s) =>
          s.id === id
            ? {
                ...s,
                ...changes,
              }
            : s,
        ),
      }))
    },
    [],
  )

  const saveSuggestion = useCallback(
    async (id: string, baseVersionId: string | null) => {
      const suggestion = state.suggestions.find((s) => s.id === id)
      if (!suggestion) return null

      try {
        const command: CreatePromptVersionCommand = {
          title: suggestion.editedTitle,
          content: suggestion.editedContent,
          summary: suggestion.editedSummary || undefined,
          source: "improve",
          baseVersionId,
        }

        const response = await fetch(
          `/api/prompts/${encodeURIComponent(promptId)}/versions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(command),
          },
        )

        if (!response.ok) {
          let body: ErrorResponseDto | null = null
          try {
            body = (await response.json()) as ErrorResponseDto
          } catch {
            // ignore
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to save improved version.",
            },
          }

          setState((prev) => ({
            ...prev,
            error,
          }))

          return null
        }

        const data = (await response.json()) as CreatePromptVersionResponseDto
        return data
      } catch (err) {
        const error = parseErrorResponse(err)
        setState((prev) => ({
          ...prev,
          error,
        }))
        return null
      }
    },
    [promptId, state.suggestions],
  )

  return {
    state,
    startImprove,
    closePanel,
    selectSuggestion,
    changeSuggestionDraft,
    saveSuggestion,
  }
}

// ---------------------------------------------------------------------------
// Runs view hooks
// ---------------------------------------------------------------------------

const DEFAULT_RUNS_PAGE_SIZE = 20

function buildRunsQueryFromFilters(filters: RunsFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize > 0) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (filters.status) {
    params.set("status", filters.status)
  }

  return params.toString()
}

/**
 * Hook for managing runs filter state with URL synchronization.
 * Resets page to 1 when status filter changes.
 */
export function useRunsFilters(initialFilters: RunsFiltersVm) {
  const router = useRouter()
  const [filters, setFilters] = useState<RunsFiltersVm>(initialFilters)

  const updateFilters = useCallback(
    (partial: Partial<RunsFiltersVm>) => {
      setFilters((prev) => {
        const next: RunsFiltersVm = {
          ...prev,
          ...partial,
        }

        // Reset page when status filter changes
        const shouldResetPage = partial.status !== undefined

        if (shouldResetPage && partial.page === undefined) {
          next.page = 1
        }

        const query = buildRunsQueryFromFilters(next)
        const href = query.length > 0 ? `?tab=runs&${query}` : "?tab=runs"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: RunsFiltersVm = {
        ...prev,
        status: null,
        page: 1,
      }

      const query = buildRunsQueryFromFilters(next)
      const href = query.length > 0 ? `?tab=runs&${query}` : "?tab=runs"

      router.replace(href, { scroll: false })

      return next
    })
  }, [router])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

/**
 * Get initial runs filters from URL search params
 */
export function getInitialRunsFilters(
  searchParams: URLSearchParams,
): RunsFiltersVm {
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(
    searchParams.get("pageSize") ?? String(DEFAULT_RUNS_PAGE_SIZE),
    10,
  )
  const status = searchParams.get("status") as RunStatus | null

  return {
    status: status && ["success", "error", "pending", "timeout"].includes(status)
      ? status
      : null,
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize:
      Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100
        ? DEFAULT_RUNS_PAGE_SIZE
        : pageSize,
  }
}

/**
 * Hook for fetching paginated run list for a prompt with filtering.
 * Automatically refetches when filters change.
 */
export function useRunsListData(promptId: PromptId, filters: RunsFiltersVm) {
  const [state, setState] = useState<RunsViewState>(() => ({
    items: [],
    page: filters.page,
    pageSize: filters.pageSize,
    total: 0,
    isLoading: true,
    isInitialLoad: true,
    error: null,
  }))
  const [reloadCounter, setReloadCounter] = useState(0)

  const queryString = useMemo(
    () => buildRunsQueryFromFilters(filters),
    [filters],
  )

  useEffect(() => {
    const abortController = new AbortController()

    async function load() {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))

      try {
        const url = `/api/prompts/${encodeURIComponent(promptId)}/runs${
          queryString ? `?${queryString}` : ""
        }`

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
            // ignore JSON parse failure; fall back to generic error
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load runs.",
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

        const data = (await response.json()) as RunListResponseDto

        if (!abortController.signal.aborted) {
          const items: RunListItemVm[] = data.items.map((item) =>
            mapRunListItemDtoToVm(item),
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
  }, [promptId, filters, queryString, reloadCounter])

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1)
  }, [])

  return { state, reload }
}

/**
 * Hook for fetching and managing run detail panel state.
 * Fetches run detail when a run is selected.
 */
export function useRunDetail() {
  const [state, setState] = useState<RunDetailPanelState>(() => ({
    selectedRunId: null,
    run: null,
    isLoading: false,
    error: null,
  }))

  const selectRun = useCallback(async (runId: RunId) => {
    setState({
      selectedRunId: runId,
      run: null,
      isLoading: true,
      error: null,
    })

    try {
      const response = await fetch(
        `/api/runs/${encodeURIComponent(runId)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      )

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
            message: "Failed to load run details.",
          },
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }))

        return
      }

      const data = (await response.json()) as RunDto
      const run = mapRunDtoToDetailVm(data)

      setState({
        selectedRunId: runId,
        run,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const error = parseErrorResponse(err)

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }))
    }
  }, [])

  const clearSelection = useCallback(() => {
    setState({
      selectedRunId: null,
      run: null,
      isLoading: false,
      error: null,
    })
  }, [])

  return {
    state,
    selectRun,
    clearSelection,
  }
}

// ---------------------------------------------------------------------------
// Versions view hooks
// ---------------------------------------------------------------------------

const DEFAULT_VERSIONS_PAGE_SIZE = 20

function buildVersionsQueryFromFilters(filters: VersionsFiltersVm): string {
  const params = new URLSearchParams()

  if (filters.page > 1) {
    params.set("page", String(filters.page))
  }

  if (filters.pageSize > 0) {
    params.set("pageSize", String(filters.pageSize))
  }

  return params.toString()
}

/**
 * Get initial versions filters from URL search params
 */
export function getInitialVersionsFilters(
  searchParams: URLSearchParams,
): VersionsFiltersVm {
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const pageSize = parseInt(
    searchParams.get("pageSize") ?? String(DEFAULT_VERSIONS_PAGE_SIZE),
    10,
  )

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize:
      Number.isNaN(pageSize) || pageSize < 1 || pageSize > 100
        ? DEFAULT_VERSIONS_PAGE_SIZE
        : pageSize,
  }
}

/**
 * Hook for managing versions filter state with URL synchronization.
 */
export function useVersionsFilters(initialFilters: VersionsFiltersVm) {
  const router = useRouter()
  const [filters, setFilters] = useState<VersionsFiltersVm>(initialFilters)

  const updateFilters = useCallback(
    (partial: Partial<VersionsFiltersVm>) => {
      setFilters((prev) => {
        const next: VersionsFiltersVm = {
          ...prev,
          ...partial,
        }

        const query = buildVersionsQueryFromFilters(next)
        const href = query.length > 0 ? `?tab=versions&${query}` : "?tab=versions"

        router.replace(href, { scroll: false })

        return next
      })
    },
    [router],
  )

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const next: VersionsFiltersVm = {
        ...prev,
        page: 1,
      }

      const query = buildVersionsQueryFromFilters(next)
      const href = query.length > 0 ? `?tab=versions&${query}` : "?tab=versions"

      router.replace(href, { scroll: false })

      return next
    })
  }, [router])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

/**
 * Hook for fetching paginated version list for a prompt.
 * Automatically refetches when filters change.
 */
export function useVersionsListData(
  promptId: PromptId,
  currentVersionId: PromptVersionId | null,
  filters: VersionsFiltersVm,
) {
  const [state, setState] = useState<VersionsViewState>(() => ({
    items: [],
    page: filters.page,
    pageSize: filters.pageSize,
    total: 0,
    isLoading: true,
    isInitialLoad: true,
    error: null,
  }))
  const [reloadCounter, setReloadCounter] = useState(0)

  const queryString = useMemo(
    () => buildVersionsQueryFromFilters(filters),
    [filters],
  )

  useEffect(() => {
    const abortController = new AbortController()

    async function load() {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }))

      try {
        const url = `/api/prompts/${encodeURIComponent(promptId)}/versions${
          queryString ? `?${queryString}` : ""
        }`

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
            // ignore JSON parse failure; fall back to generic error
          }

          const error = body ?? {
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to load versions.",
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

        const data = (await response.json()) as PromptVersionListResponseDto

        if (!abortController.signal.aborted) {
          const items: VersionListItemVm[] = data.items.map((item) =>
            mapVersionStubDtoToVm(item, currentVersionId),
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
  }, [promptId, currentVersionId, filters, queryString, reloadCounter])

  const reload = useCallback(() => {
    setReloadCounter((value) => value + 1)
  }, [])

  return { state, reload }
}

/**
 * Hook for fetching and managing version detail panel state.
 * Fetches version detail when a version is selected and handles restore flow.
 */
export function useVersionDetail(
  promptId: PromptId,
  currentVersionId: PromptVersionId | null,
) {
  const [state, setState] = useState<VersionDetailPanelState>(() => ({
    selectedVersionId: null,
    version: null,
    isLoading: false,
    error: null,
    isRestoring: false,
    restoreError: null,
    showRestoreConfirmation: false,
    restoreSummary: "",
  }))

  const selectVersion = useCallback(
    async (versionId: PromptVersionId) => {
      setState((prev) => ({
        ...prev,
        selectedVersionId: versionId,
        version: null,
        isLoading: true,
        error: null,
        isRestoring: false,
        restoreError: null,
        showRestoreConfirmation: false,
        restoreSummary: "",
      }))

      try {
        const response = await fetch(
          `/api/prompts/${encodeURIComponent(promptId)}/versions/${encodeURIComponent(versionId)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        )

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
              message: "Failed to load version details.",
            },
          }

          setState((prev) => ({
            ...prev,
            isLoading: false,
            error,
          }))

          return
        }

        const data = (await response.json()) as PromptVersionDto
        const version = mapVersionDtoToDetailVm(data, currentVersionId)

        setState((prev) => ({
          ...prev,
          version,
          isLoading: false,
          error: null,
        }))
      } catch (err) {
        const error = parseErrorResponse(err)

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }))
      }
    },
    [promptId, currentVersionId],
  )

  const clearSelection = useCallback(() => {
    setState({
      selectedVersionId: null,
      version: null,
      isLoading: false,
      error: null,
      isRestoring: false,
      restoreError: null,
      showRestoreConfirmation: false,
      restoreSummary: "",
    })
  }, [])

  const startRestore = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showRestoreConfirmation: true,
      restoreError: null,
    }))
  }, [])

  const cancelRestore = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showRestoreConfirmation: false,
      restoreSummary: "",
    }))
  }, [])

  const setRestoreSummary = useCallback((summary: string) => {
    setState((prev) => ({
      ...prev,
      restoreSummary: summary,
    }))
  }, [])

  const confirmRestore = useCallback(async (): Promise<RestorePromptVersionResponseDto | null> => {
    const versionId = state.selectedVersionId
    if (!versionId) return null

    setState((prev) => ({
      ...prev,
      isRestoring: true,
      restoreError: null,
    }))

    try {
      const command: RestorePromptVersionCommand = {
        summary: state.restoreSummary || undefined,
      }

      const response = await fetch(
        `/api/prompts/${encodeURIComponent(promptId)}/versions/${encodeURIComponent(versionId)}/restore`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(command),
        },
      )

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
            message: "Failed to restore version.",
          },
        }

        setState((prev) => ({
          ...prev,
          isRestoring: false,
          restoreError: error,
        }))

        return null
      }

      const data = (await response.json()) as RestorePromptVersionResponseDto

      setState((prev) => ({
        ...prev,
        isRestoring: false,
        showRestoreConfirmation: false,
        restoreSummary: "",
      }))

      return data
    } catch (err) {
      const error = parseErrorResponse(err)

      setState((prev) => ({
        ...prev,
        isRestoring: false,
        restoreError: error,
      }))

      return null
    }
  }, [promptId, state.selectedVersionId, state.restoreSummary])

  return {
    state,
    selectVersion,
    clearSelection,
    startRestore,
    cancelRestore,
    setRestoreSummary,
    confirmRestore,
  }
}
