import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  Json,
} from "@/db/database.types"

/**
 * Base entity aliases derived from the Supabase-generated Database types.
 * These keep DTOs strongly connected to the underlying tables.
 */
export type CatalogEntity = Tables<"catalogs">
export type TagEntity = Tables<"tags">
export type PromptEntity = Tables<"prompts">
export type PromptVersionEntity = Tables<"prompt_versions">
export type RunEntity = Tables<"runs">
export type RunEventEntity = Tables<"run_events">
export type PromptTagEntity = Tables<"prompt_tags">
export type UserSettingsEntity = Tables<"user_settings">

type CatalogInsert = TablesInsert<"catalogs">
type CatalogUpdate = TablesUpdate<"catalogs">
type TagInsert = TablesInsert<"tags">
type TagUpdate = TablesUpdate<"tags">
type PromptInsert = TablesInsert<"prompts">
type PromptUpdate = TablesUpdate<"prompts">
type PromptVersionInsert = TablesInsert<"prompt_versions">
type RunInsert = TablesInsert<"runs">
type UserSettingsInsert = TablesInsert<"user_settings">
type UserSettingsUpdate = TablesUpdate<"user_settings">

/**
 * Common scalar aliases to keep ID/timestamp types in sync with DB.
 */
export type UserId = UserSettingsEntity["user_id"]
export type PromptId = PromptEntity["id"]
export type PromptVersionId = PromptVersionEntity["id"]
export type RunId = RunEntity["id"]
export type RunEventId = RunEventEntity["id"]
export type TagId = TagEntity["id"]
export type CatalogId = CatalogEntity["id"]
export type IsoTimestampString = PromptEntity["created_at"]
export type JsonValue = Json

export type RunStatus = Enums<"run_status">
export type RetentionPolicy = Enums<"retention_policy">

/**
 * Run event types are constrained at the API layer even though the DB
 * column is a plain string. This union documents the allowed values.
 */
export type RunEventType =
  | "run"
  | "improve"
  | "improve_saved"
  | "delete"
  | "restore"

/**
 * Generic pagination wrapper used by many list endpoints.
 */
export interface PaginatedDto<TItem> {
  items: TItem[]
  page: number
  pageSize: number
  total: number
}

/**
 * Standard API error envelope.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR"
  | "OPENROUTER_ERROR"

export type FieldErrors = Record<string, string[]>

export interface ErrorDetails {
  fieldErrors?: FieldErrors
  // Allow additional structured error metadata.
  [key: string]: JsonValue | undefined
}

export interface ErrorResponseDto {
  error: {
    code: ErrorCode
    message: string
    details?: ErrorDetails
  }
}

/**
 * /api/me – authenticated user representation.
 */
export interface CurrentUserSettingsDto {
  retentionPolicy: RetentionPolicy
}

export interface CurrentUserDto {
  id: UserId
  email: string
  createdAt: IsoTimestampString
  settings: CurrentUserSettingsDto
}

/**
 * /api/settings – user settings DTO and command models.
 */
export interface UserSettingsDto {
  userId: UserSettingsEntity["user_id"]
  retentionPolicy: RetentionPolicy
  createdAt: UserSettingsEntity["created_at"]
  updatedAt: UserSettingsEntity["updated_at"]
}

export interface UpdateUserSettingsCommand {
  retentionPolicy: RetentionPolicy
}

/**
 * /api/catalogs – catalog DTOs and commands.
 */
export interface CatalogDto {
  id: CatalogEntity["id"]
  name: CatalogEntity["name"]
  description: CatalogEntity["description"]
  createdAt: CatalogEntity["created_at"]
  updatedAt: CatalogEntity["updated_at"]
}

export type CreateCatalogCommand = Pick<CatalogInsert, "name" | "description">

export type UpdateCatalogCommand = Partial<
  Pick<CatalogUpdate, "name" | "description">
>

export type CatalogListResponseDto = PaginatedDto<CatalogDto>

/**
 * /api/tags – tag DTOs and commands.
 */
export interface TagDto {
  id: TagEntity["id"]
  name: TagEntity["name"]
  createdAt: TagEntity["created_at"]
}

export type CreateTagCommand = Pick<TagInsert, "name">

export type UpdateTagCommand = Pick<TagUpdate, "name">

export type TagListResponseDto = PaginatedDto<TagDto>

/**
 * /api/prompts/{promptId}/tags – prompt–tag association commands/DTOs.
 */
export interface ReplacePromptTagsCommand {
  tagIds: TagId[]
}

export interface PromptTagsDto {
  promptId: PromptId
  tagIds: TagId[]
}

/**
 * Common nested DTOs for prompts.
 */
export type PromptTagSummaryDto = Pick<TagDto, "id" | "name">

export interface PromptLastRunSummaryDto {
  id: RunId
  status: RunStatus
  createdAt: RunEntity["created_at"]
  model: RunEntity["model"]
  latencyMs: RunEntity["latency_ms"] | null
}

export interface PromptListItemDto {
  id: PromptId
  title: PromptEntity["title"]
  catalogId: PromptEntity["catalog_id"] | null
  tags: PromptTagSummaryDto[]
  currentVersionId: PromptEntity["current_version_id"] | null
  lastRun: PromptLastRunSummaryDto | null
  createdAt: PromptEntity["created_at"]
  updatedAt: PromptEntity["updated_at"]
}

export interface PromptCurrentVersionDto {
  id: PromptVersionId
  title: PromptVersionEntity["title"]
  content: PromptVersionEntity["content"]
  summary: PromptVersionEntity["summary"]
  createdAt: PromptVersionEntity["created_at"]
}

export interface PromptVersionStubDto {
  id: PromptVersionId
   title: PromptVersionEntity["title"]
  summary: PromptVersionEntity["summary"]
  createdAt: PromptVersionEntity["created_at"]
}

export interface PromptRunStubDto {
  id: RunId
  status: RunStatus
  createdAt: RunEntity["created_at"]
}

export interface PromptDetailDto {
  id: PromptId
  title: PromptEntity["title"]
  catalogId: PromptEntity["catalog_id"] | null
  tags: PromptTagSummaryDto[]
  currentVersion: PromptCurrentVersionDto | null
  lastRun: PromptLastRunSummaryDto | null
  createdAt: PromptEntity["created_at"]
  updatedAt: PromptEntity["updated_at"]
  // Present only when includeVersions=true
  versions?: PromptVersionStubDto[]
  // Present only when includeRuns=true
  runs?: PromptRunStubDto[]
}

export type PromptListResponseDto = PaginatedDto<PromptListItemDto>

/**
 * /api/prompts – create/update/delete commands and related DTOs.
 */
export interface CreatePromptCommand {
  title: PromptInsert["title"]
  content: PromptVersionInsert["content"]
  catalogId?: PromptInsert["catalog_id"] | null
  tagIds?: TagId[]
  summary?: PromptVersionInsert["summary"]
}

export interface PromptDuplicateWarningDto {
  similarPromptIds: PromptId[]
  confidence: number
}

export interface CreatePromptResponseDto {
  prompt: PromptListItemDto
  version: PromptCurrentVersionDto
  duplicateWarning?: PromptDuplicateWarningDto
}

export interface UpdatePromptMetadataCommand {
  title?: PromptUpdate["title"]
  catalogId?: PromptUpdate["catalog_id"] | null
  tagIds?: TagId[]
}

export interface DeletePromptCommand {
  confirm: boolean
}

/**
 * Prompt versions DTOs and commands.
 */
export type PromptVersionSource = "manual" | "improve"

export interface PromptVersionDto {
  id: PromptVersionId
  promptId: PromptId
  title: PromptVersionEntity["title"]
  content: PromptVersionEntity["content"]
  summary: PromptVersionEntity["summary"]
  createdBy: PromptVersionEntity["created_by"]
  createdAt: PromptVersionEntity["created_at"]
}

export type PromptVersionListResponseDto = PaginatedDto<PromptVersionStubDto>

export interface CreatePromptVersionCommand {
  title: PromptVersionInsert["title"]
  content: PromptVersionInsert["content"]
  summary?: PromptVersionInsert["summary"]
  source: PromptVersionSource
  baseVersionId?: PromptVersionId | null
}

export interface PromptVersionedPromptDto {
  id: PromptId
  currentVersionId: PromptEntity["current_version_id"]
  updatedAt: PromptEntity["updated_at"]
}

export interface CreatePromptVersionResponseDto {
  version: PromptVersionDto
  prompt: PromptVersionedPromptDto
}

export type GetPromptVersionResponseDto = PromptVersionDto

export interface RestorePromptVersionCommand {
  summary?: PromptVersionInsert["summary"]
}

export type RestorePromptVersionResponseDto = CreatePromptVersionResponseDto

/**
 * Runs – shared nested DTOs and main run representations.
 */
export interface RunInputDto {
  variables: Record<string, JsonValue>
  overridePrompt?: string | null
  // Allow additional payload fields without losing Json safety.
  [key: string]: JsonValue | undefined
}

export interface RunOutputDto {
  text?: string
  [key: string]: JsonValue | undefined
}

export interface RunModelMetadataDto {
  provider?: string
  raw?: JsonValue
  [key: string]: JsonValue | undefined
}

export interface RunTokenUsageDto {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
}

export interface RunDto {
  id: RunId
  promptId: PromptId
  userId: UserId
  model: RunEntity["model"]
  status: RunStatus
  input: RunInputDto
  output: RunOutputDto | null
  modelMetadata: RunModelMetadataDto | null
  tokenUsage: RunTokenUsageDto | null
  latencyMs: RunEntity["latency_ms"] | null
  errorMessage: RunEntity["error_message"]
  createdAt: RunEntity["created_at"]
}

export interface RunListItemDto {
  id: RunId
  status: RunStatus
  model: RunEntity["model"]
  latencyMs: RunEntity["latency_ms"] | null
  createdAt: RunEntity["created_at"]
}

export type RunListResponseDto = PaginatedDto<RunListItemDto>

export interface RunOptionsDto {
  temperature?: number
  maxTokens?: number
  [key: string]: JsonValue | undefined
}

export interface CreateRunCommand {
  model: RunInsert["model"]
  input: RunInputDto
  options?: RunOptionsDto
}

export interface CreateRunResponseDto {
  run: RunDto
}

export type GetRunResponseDto = RunDto

/**
 * Improve workflow DTOs and commands.
 */
export interface ImprovePromptInputDto {
  currentPrompt: string
  goals?: string
  constraints?: string
  numSuggestions?: number
}

export interface ImprovePromptCommand {
  model: RunInsert["model"]
  input: ImprovePromptInputDto
  options?: RunOptionsDto
}

export interface ImproveSuggestionDto {
  id: string
  title: PromptVersionEntity["title"]
  content: PromptVersionEntity["content"]
  summary?: PromptVersionEntity["summary"]
  model: RunEntity["model"]
  tokenUsage?: RunTokenUsageDto
}

export interface ImprovePromptResponseDto {
  suggestions: ImproveSuggestionDto[]
  latencyMs: RunEntity["latency_ms"] | null
}

/**
 * Search DTOs.
 */
export interface SearchPromptResultItemDto {
  id: PromptId
  title: PromptEntity["title"]
  snippet: string
  score: number
  catalog: Pick<CatalogDto, "id" | "name"> | null
  tags: PromptTagSummaryDto[]
  updatedAt: PromptEntity["updated_at"]
}

export type SearchPromptsResponseDto = PaginatedDto<SearchPromptResultItemDto>

/**
 * Admin / analytics DTOs.
 */
export interface RunEventDto {
  id: RunEventId
  createdAt: RunEventEntity["created_at"]
  eventType: RunEventType
  payload: RunEventEntity["payload"]
  promptId: PromptId | null
  userId: UserId
}

export type RunEventListResponseDto = PaginatedDto<RunEventDto>

export interface AdminRunsPerDayDto {
  date: string
  runs: number
  improves: number
}

export interface AdminMetricsDto {
  runsPerDay: AdminRunsPerDayDto[]
  improveSaveRate: number
  averageLatencyMs: number
  errorRate: number
}


