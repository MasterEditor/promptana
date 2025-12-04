import type {
  CatalogDto,
  CatalogId,
  CurrentUserDto,
  ErrorCode,
  ErrorResponseDto,
  QuotaDto,
  TagId,
} from "@/types"

export type NavSectionId = "prompts" | "catalogs" | "tags" | "search" | "settings"

export interface NavItemVm {
  id: NavSectionId
  label: string
  href: string
  iconName?: string
  isActive: boolean
}

export interface CatalogNavItemVm {
  id: CatalogId
  name: string
  href: string
  isActive: boolean
}

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated" | "error"

export interface AuthStateVm {
  status: AuthStatus
  user: CurrentUserDto | null
  error: ErrorResponseDto | null
}

export interface TopBarSearchState {
  query: string
  tagIds?: TagId[]
  catalogId?: CatalogId | null
}

export interface QuotaSummaryVm {
  remainingRun: number
  remainingImprove: number
  runUsagePercent: number
  improveUsagePercent: number
  isDailyRunCapReached: boolean
  isDailyImproveCapReached: boolean
  isAnyCostCapBlocked: boolean
}

export type GlobalMessageType = "info" | "success" | "warning" | "error"

export interface GlobalMessage {
  id: string
  type: GlobalMessageType
  title?: string
  message: string
  code?: ErrorCode
}

export interface OfflineState {
  isOffline: boolean
  lastChangedAt: Date | null
}

export interface QuotaContextValue {
  quota: QuotaDto | null
  summary: QuotaSummaryVm | null
  isLoading: boolean
  error: ErrorResponseDto | null
  refresh(): Promise<void>
}

export interface GlobalMessagesContextValue {
  messages: GlobalMessage[]
  addMessage(message: Omit<GlobalMessage, "id">): void
  addErrorFromApi(error: ErrorResponseDto): void
  removeMessage(id: string): void
}

export interface OfflineContextValue extends OfflineState {}


