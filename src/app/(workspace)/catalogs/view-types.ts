import type { CatalogDto, CatalogId, ErrorResponseDto } from "@/types"

/**
 * Validation constants matching API limits
 */
export const CATALOG_NAME_MAX_LENGTH = 255
export const CATALOG_DESCRIPTION_MAX_LENGTH = 2000

/**
 * Filter and pagination state for catalogs list
 */
export interface CatalogsListFiltersVm {
  search: string
  page: number
  pageSize: number
}

/**
 * View model for a catalog list item with display labels
 */
export interface CatalogListItemVm {
  id: CatalogId
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  createdAtLabel: string
  updatedAtLabel: string
}

/**
 * State for the catalogs list view
 */
export interface CatalogsViewState {
  items: CatalogListItemVm[]
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
export interface CatalogFormData {
  name: string
  description: string
}

/**
 * Field-level validation errors
 */
export interface CatalogFieldErrors {
  name?: string[]
  description?: string[]
}

/**
 * State for the catalog create/edit dialog
 */
export interface CatalogDialogState {
  open: boolean
  mode: "create" | "edit"
  catalogId: CatalogId | null
  formData: CatalogFormData
  isSubmitting: boolean
  fieldErrors: CatalogFieldErrors
  formError: string | null
}

/**
 * State for the delete confirmation dialog
 */
export interface DeleteCatalogDialogState {
  open: boolean
  catalog: CatalogListItemVm | null
  isDeleting: boolean
}

/**
 * Format ISO timestamp to localized string
 */
export function formatDateTimeLabel(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

/**
 * Map CatalogDto to CatalogListItemVm with display labels
 */
export function mapCatalogDtoToVm(dto: CatalogDto): CatalogListItemVm {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    createdAtLabel: formatDateTimeLabel(dto.createdAt),
    updatedAtLabel: formatDateTimeLabel(dto.updatedAt),
  }
}

/**
 * Create empty form data for new catalog
 */
export function createEmptyCatalogFormData(): CatalogFormData {
  return {
    name: "",
    description: "",
  }
}

/**
 * Create form data from existing catalog
 */
export function catalogToFormData(catalog: CatalogListItemVm): CatalogFormData {
  return {
    name: catalog.name,
    description: catalog.description ?? "",
  }
}

