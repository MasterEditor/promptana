import type {
  CatalogId,
  CatalogDto,
  ErrorResponseDto,
  PromptDetailDto,
  PromptId,
  PromptLastRunSummaryDto,
  PromptListItemDto,
  PromptTagSummaryDto,
  PromptVersionDto,
  PromptVersionId,
  PromptVersionStubDto,
  RunDto,
  RunId,
  RunInputDto,
  RunListItemDto,
  RunModelMetadataDto,
  RunOutputDto,
  RunStatus,
  RunTokenUsageDto,
  TagDto,
  TagId,
  UserId,
} from "@/types"

// ---------------------------------------------------------------------------
// Shared utility types and functions
// ---------------------------------------------------------------------------

export type SearchParamsRecord = Record<string, string | string[] | undefined>

/**
 * Convert a plain search params record to URLSearchParams.
 * Useful when receiving search params from server components
 * (which can't pass URLSearchParams to client components).
 */
export function searchParamsRecordToURLSearchParams(
  params: SearchParamsRecord,
): URLSearchParams {
  const urlSearchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      urlSearchParams.set(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v))
    }
  }
  return urlSearchParams
}

export type PromptListSort =
  | "updatedAtDesc"
  | "createdAtDesc"
  | "titleAsc"
  | "lastRunDesc"
  | "relevance"

export type PromptDensityMode = "comfortable" | "compact"

export interface PromptListFiltersVm {
  search: string
  tagIds: TagId[]
  catalogId: CatalogId | null
  sort: PromptListSort
  page: number
  pageSize: number
}

export interface PromptListItemVm {
  id: PromptId
  title: string
  catalogId: CatalogId | null
  tags: PromptTagSummaryDto[]
  lastRun: PromptLastRunSummaryDto | null
  createdAt: string
  updatedAt: string
  createdAtLabel: string
  updatedAtLabel: string
  lastRunStatusLabel: string
  lastRunTimestampLabel: string | null
  canRun: boolean
  canDelete: boolean
}

export interface PromptsViewState {
  items: PromptListItemVm[]
  page: number
  pageSize: number
  total: number
  isLoading: boolean
  isInitialLoad: boolean
  error: ErrorResponseDto | null
}

export interface PromptFiltersOptionsVm {
  availableTags: TagDto[]
  availableCatalogs: CatalogDto[]
}

function formatDateTimeLabel(iso: string): string {
  if (!iso) return ""

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleString()
}

export function getLastRunStatusLabel(
  lastRun: PromptLastRunSummaryDto | null,
): string {
  if (!lastRun) return "Never run"

  switch (lastRun.status) {
    case "success":
      return "Success"
    case "error":
      return "Error"
    case "pending":
      return "Pending"
    case "timeout":
      return "Timeout"
    default:
      return "Unknown"
  }
}

export function formatLastRunTimestamp(
  lastRun: PromptLastRunSummaryDto | null,
): string | null {
  if (!lastRun) return null
  return formatDateTimeLabel(lastRun.createdAt)
}

export function mapPromptListItemDtoToVm(
  dto: PromptListItemDto,
): PromptListItemVm {
  const createdAtLabel = formatDateTimeLabel(dto.createdAt)
  const updatedAtLabel = formatDateTimeLabel(dto.updatedAt)
  const lastRunStatusLabel = getLastRunStatusLabel(dto.lastRun)
  const lastRunTimestampLabel = formatLastRunTimestamp(dto.lastRun)

  return {
    id: dto.id,
    title: dto.title,
    catalogId: dto.catalogId,
    tags: dto.tags,
    lastRun: dto.lastRun,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    createdAtLabel,
    updatedAtLabel,
    lastRunStatusLabel,
    lastRunTimestampLabel,
    // These capability flags are derived from offline context in the view;
    // they default to true here and can be overridden at render time.
    canRun: true,
    canDelete: true,
  }
}

// ---------------------------------------------------------------------------
// Prompt detail view models
// ---------------------------------------------------------------------------

export const PROMPT_CONTENT_MAX = 100_000
export const PROMPT_CONTENT_SOFT_LIMIT = 80_000

export interface PromptDetailVm {
  id: PromptId
  title: string
  catalogId: CatalogId | null
  tags: PromptTagSummaryDto[]
  currentVersionId: PromptVersionId | null
  content: string
  summary: string | null
  createdAt: string
  updatedAt: string
  createdAtLabel: string
  updatedAtLabel: string
  lastRun: PromptLastRunSummaryDto | null
  lastRunStatusLabel: string
  lastRunTimestampLabel: string | null
  canRun: boolean
  canImprove: boolean
  canDelete: boolean
  canSave: boolean
  contentCharCount: number
  contentAtLimit: boolean
  contentNearLimit: boolean
  isResultPanelCollapsed: boolean
}

export interface PromptDetailEditorState {
  draftTitle: string
  draftCatalogId: CatalogId | null
  draftTagIds: TagId[]
  draftContent: string
  draftSummary: string
  contentCharCount: number
  contentAtLimit: boolean
  contentNearLimit: boolean
  isDirty: boolean
  isSavingVersion: boolean
  isSavingMetadataOnly: boolean
  fieldErrors: {
    title?: string[]
    content?: string[]
    catalogId?: string[]
    tagIds?: string[]
    summary?: string[]
  }
  formErrorMessage?: string
}

export interface PromptLastRunVm {
  statusLabel: string
  timestampLabel: string | null
  modelLabel: string
  latencyLabel: string | null
  outputSnippet: string | null
}

export interface ImproveSuggestionVm {
  id: string
  model: string
  title: string
  content: string
  summary: string | null
  tokenUsageLabel?: string
  isSelected: boolean
  isEditing: boolean
  editedTitle: string
  editedContent: string
  editedSummary: string
}

export interface ImproveSuggestionsVm {
  isOpen: boolean
  isLoading: boolean
  error: ErrorResponseDto | null
  selectedSuggestionId: string | null
  suggestions: ImproveSuggestionVm[]
}

export interface UnsavedChangesVm {
  isOpen: boolean
  nextAction: "navigate" | "run" | "improve" | null
  // Route information or other payload associated with the next action.
  // The consumer is responsible for narrowing this type.
  nextActionPayload?: unknown
  message: string
}

export interface PromptDetailViewState {
  prompt: PromptDetailVm | null
  editor: PromptDetailEditorState
  isLoadingInitial: boolean
  isReloading: boolean
  error: ErrorResponseDto | null
  isRunning: boolean
  isImproving: boolean
  isDeleting: boolean
  isCopying: boolean
  unsavedChanges: UnsavedChangesVm
  isOffline: boolean
}

export function mapPromptDetailDtoToVm(dto: PromptDetailDto): PromptDetailVm {
  const createdAtLabel = formatDateTimeLabel(dto.createdAt)
  const updatedAtLabel = formatDateTimeLabel(dto.updatedAt)

  const content = dto.currentVersion?.content ?? ""
  const summary = dto.currentVersion?.summary ?? null
  const contentCharCount = content.length
  const contentAtLimit = contentCharCount > PROMPT_CONTENT_MAX
  const contentNearLimit = !contentAtLimit &&
    contentCharCount >= PROMPT_CONTENT_SOFT_LIMIT

  const lastRunStatusLabel = getLastRunStatusLabel(dto.lastRun)
  const lastRunTimestampLabel = formatLastRunTimestamp(dto.lastRun)

  return {
    id: dto.id,
    title: dto.title,
    catalogId: dto.catalogId,
    tags: dto.tags,
    currentVersionId: dto.currentVersion?.id ?? null,
    content,
    summary,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    createdAtLabel,
    updatedAtLabel,
    lastRun: dto.lastRun,
    lastRunStatusLabel,
    lastRunTimestampLabel,
    // Capability flags are refined at render-time using offline context.
    canRun: true,
    canImprove: true,
    canDelete: true,
    canSave: false,
    contentCharCount,
    contentAtLimit,
    contentNearLimit,
    isResultPanelCollapsed: false,
  }
}

// ---------------------------------------------------------------------------
// Runs view models and types
// ---------------------------------------------------------------------------

/**
 * Filter state for runs list
 */
export interface RunsFiltersVm {
  status: RunStatus | null
  page: number
  pageSize: number
}

/**
 * View model for a run list item with display labels
 */
export interface RunListItemVm {
  id: RunId
  status: RunStatus
  statusLabel: string
  model: string
  latencyMs: number | null
  latencyLabel: string
  createdAt: string
  createdAtLabel: string
}

/**
 * View model for full run detail with display labels
 */
export interface RunDetailVm {
  id: RunId
  promptId: PromptId
  status: RunStatus
  statusLabel: string
  model: string
  input: RunInputDto
  output: RunOutputDto | null
  outputText: string | null
  modelMetadata: RunModelMetadataDto | null
  tokenUsage: RunTokenUsageDto | null
  tokenUsageLabel: string | null
  latencyMs: number | null
  latencyLabel: string
  errorMessage: string | null
  createdAt: string
  createdAtLabel: string
}

/**
 * State for the runs list view
 */
export interface RunsViewState {
  items: RunListItemVm[]
  page: number
  pageSize: number
  total: number
  isLoading: boolean
  isInitialLoad: boolean
  error: ErrorResponseDto | null
}

/**
 * State for run detail panel
 */
export interface RunDetailPanelState {
  selectedRunId: RunId | null
  run: RunDetailVm | null
  isLoading: boolean
  error: ErrorResponseDto | null
}

/**
 * Get human-readable label for run status
 */
export function getRunStatusLabel(status: RunStatus): string {
  switch (status) {
    case "success":
      return "Success"
    case "error":
      return "Error"
    case "pending":
      return "Pending"
    case "timeout":
      return "Timeout"
    default:
      return "Unknown"
  }
}

/**
 * Format latency in milliseconds to human-readable string
 */
export function formatLatency(latencyMs: number | null): string {
  if (latencyMs === null) return "—"
  if (latencyMs < 1000) return `${latencyMs}ms`
  return `${(latencyMs / 1000).toFixed(2)}s`
}

/**
 * Format token usage to human-readable string
 */
export function formatTokenUsage(
  tokenUsage: RunTokenUsageDto | null,
): string | null {
  if (!tokenUsage) return null
  const { inputTokens, outputTokens, totalTokens } = tokenUsage
  const total = totalTokens ?? inputTokens + outputTokens
  return `${inputTokens} in / ${outputTokens} out (${total} total)`
}

/**
 * Map RunListItemDto to RunListItemVm with display labels
 */
export function mapRunListItemDtoToVm(dto: RunListItemDto): RunListItemVm {
  return {
    id: dto.id,
    status: dto.status,
    statusLabel: getRunStatusLabel(dto.status),
    model: dto.model,
    latencyMs: dto.latencyMs,
    latencyLabel: formatLatency(dto.latencyMs),
    createdAt: dto.createdAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
  }
}

/**
 * Map RunDto to RunDetailVm with display labels
 */
export function mapRunDtoToDetailVm(dto: RunDto): RunDetailVm {
  return {
    id: dto.id,
    promptId: dto.promptId,
    status: dto.status,
    statusLabel: getRunStatusLabel(dto.status),
    model: dto.model,
    input: dto.input,
    output: dto.output,
    outputText: dto.output?.text ?? null,
    modelMetadata: dto.modelMetadata,
    tokenUsage: dto.tokenUsage,
    tokenUsageLabel: formatTokenUsage(dto.tokenUsage),
    latencyMs: dto.latencyMs,
    latencyLabel: formatLatency(dto.latencyMs),
    errorMessage: dto.errorMessage,
    createdAt: dto.createdAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
  }
}

// ---------------------------------------------------------------------------
// Versions view models and types
// ---------------------------------------------------------------------------

/**
 * Filter/pagination state for versions list
 */
export interface VersionsFiltersVm {
  page: number
  pageSize: number
}

/**
 * View model for a version list item with display labels
 */
export interface VersionListItemVm {
  id: PromptVersionId
  title: string
  summary: string | null
  createdAt: string
  createdAtLabel: string
  isCurrent: boolean
}

/**
 * View model for full version detail with display labels
 */
export interface VersionDetailVm {
  id: PromptVersionId
  promptId: PromptId
  title: string
  content: string
  summary: string | null
  createdBy: UserId | null
  createdAt: string
  createdAtLabel: string
  isCurrent: boolean
  contentCharCount: number
}

/**
 * State for the versions list view
 */
export interface VersionsViewState {
  items: VersionListItemVm[]
  page: number
  pageSize: number
  total: number
  isLoading: boolean
  isInitialLoad: boolean
  error: ErrorResponseDto | null
}

/**
 * State for version detail panel
 */
export interface VersionDetailPanelState {
  selectedVersionId: PromptVersionId | null
  version: VersionDetailVm | null
  isLoading: boolean
  error: ErrorResponseDto | null
  isRestoring: boolean
  restoreError: ErrorResponseDto | null
  showRestoreConfirmation: boolean
  restoreSummary: string
}

/**
 * Map PromptVersionStubDto to VersionListItemVm
 */
export function mapVersionStubDtoToVm(
  dto: PromptVersionStubDto,
  currentVersionId: PromptVersionId | null,
): VersionListItemVm {
  return {
    id: dto.id,
    title: dto.title,
    summary: dto.summary,
    createdAt: dto.createdAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
    isCurrent: dto.id === currentVersionId,
  }
}

/**
 * Map PromptVersionDto to VersionDetailVm
 */
export function mapVersionDtoToDetailVm(
  dto: PromptVersionDto,
  currentVersionId: PromptVersionId | null,
): VersionDetailVm {
  return {
    id: dto.id,
    promptId: dto.promptId,
    title: dto.title,
    content: dto.content,
    summary: dto.summary,
    createdBy: dto.createdBy,
    createdAt: dto.createdAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
    isCurrent: dto.id === currentVersionId,
    contentCharCount: dto.content.length,
  }
}
