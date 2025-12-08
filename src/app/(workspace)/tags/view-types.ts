import type { TagDto, TagId, ErrorResponseDto } from "@/types"

/**
 * Validation constants matching API limits
 */
export const TAG_NAME_MAX_LENGTH = 255

/**
 * Filter and pagination state for tags list
 */
export interface TagsListFiltersVm {
  search: string
  page: number
  pageSize: number
}

/**
 * View model for a tag list item with display labels
 */
export interface TagListItemVm {
  id: TagId
  name: string
  createdAt: string
  createdAtLabel: string
}

/**
 * State for the tags list view
 */
export interface TagsViewState {
  items: TagListItemVm[]
  page: number
  pageSize: number
  total: number
  isLoading: boolean
  isInitialLoad: boolean
  error: ErrorResponseDto | null
}

/**
 * Form data for create/edit dialog
 */
export interface TagFormData {
  name: string
}

/**
 * Field-level validation errors for tag form
 */
export interface TagFieldErrors {
  name?: string[]
}

/**
 * State for the tag create/edit dialog
 */
export interface TagDialogState {
  open: boolean
  mode: "create" | "edit"
  tagId: TagId | null
  formData: TagFormData
  isSubmitting: boolean
  fieldErrors: TagFieldErrors
  formError: string | null
}

/**
 * State for the delete confirmation dialog
 */
export interface DeleteTagDialogState {
  open: boolean
  tag: TagListItemVm | null
  isDeleting: boolean
}

/**
 * Format ISO timestamp to localized date/time string
 */
export function formatDateTimeLabel(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

/**
 * Map TagDto to TagListItemVm with display labels
 */
export function mapTagDtoToVm(dto: TagDto): TagListItemVm {
  return {
    id: dto.id,
    name: dto.name,
    createdAt: dto.createdAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
  }
}

/**
 * Create empty form data for new tag
 */
export function createEmptyTagFormData(): TagFormData {
  return {
    name: "",
  }
}

/**
 * Create form data from existing tag
 */
export function tagToFormData(tag: TagListItemVm): TagFormData {
  return {
    name: tag.name,
  }
}

