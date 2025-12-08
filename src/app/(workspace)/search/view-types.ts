import type {
  CatalogDto,
  CatalogId,
  ErrorResponseDto,
  PromptId,
  PromptTagSummaryDto,
  SearchPromptResultItemDto,
  TagDto,
  TagId,
} from "@/types"

/**
 * Sort options for search results
 */
export type SearchSortOption = "relevance" | "updatedAtDesc"

/**
 * Filter state for search view
 */
export interface SearchFiltersVm {
  q: string
  tagIds: TagId[]
  catalogId: CatalogId | null
  sort: SearchSortOption
  page: number
  pageSize: number
}

/**
 * View model for individual search result item
 */
export interface SearchResultItemVm {
  id: PromptId
  title: string
  /** HTML snippet with <b> tags for highlights */
  snippet: string
  /** Relevance score (0-1) */
  score: number
  /** Display percentage for score visualization */
  scorePercentage: number
  catalog: { id: CatalogId; name: string } | null
  tags: PromptTagSummaryDto[]
  updatedAt: string
  updatedAtLabel: string
}

/**
 * State for search results list
 */
export interface SearchViewState {
  items: SearchResultItemVm[]
  page: number
  pageSize: number
  total: number
  isLoading: boolean
  isInitialLoad: boolean
  error: ErrorResponseDto | null
}

/**
 * Options available for filters (tags and catalogs)
 */
export interface SearchFiltersOptionsVm {
  availableTags: TagDto[]
  availableCatalogs: CatalogDto[]
}

/**
 * Format date/time for display
 */
export function formatDateTimeLabel(iso: string): string {
  if (!iso) return ""

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleString()
}

/**
 * Map DTO to view model
 */
export function mapSearchResultDtoToVm(
  dto: SearchPromptResultItemDto
): SearchResultItemVm {
  return {
    id: dto.id,
    title: dto.title,
    snippet: dto.snippet,
    score: dto.score,
    scorePercentage: Math.round(dto.score * 100),
    catalog: dto.catalog,
    tags: dto.tags,
    updatedAt: dto.updatedAt,
    updatedAtLabel: formatDateTimeLabel(dto.updatedAt),
  }
}

