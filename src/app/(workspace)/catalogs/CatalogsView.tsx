'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  useCatalogsListFilters,
  useCatalogsListData,
  useCatalogDialog,
  useDeleteCatalogDialog,
} from "./hooks"
import type {
  CatalogDialogState,
  CatalogFormData,
  CatalogListItemVm,
  CatalogsListFiltersVm,
  DeleteCatalogDialogState,
} from "./view-types"
import { CATALOG_NAME_MAX_LENGTH, CATALOG_DESCRIPTION_MAX_LENGTH } from "./view-types"

interface CatalogsViewProps {
  initialFilters: CatalogsListFiltersVm
}

export default function CatalogsView({ initialFilters }: CatalogsViewProps) {
  const { filters, updateFilters, resetFilters } = useCatalogsListFilters(initialFilters)
  const { state, reload } = useCatalogsListData(filters)

  const catalogDialog = useCatalogDialog(reload)
  const deleteDialog = useDeleteCatalogDialog(reload)

  const hasResults = state.total > 0
  const hasSearch = filters.search.trim().length > 0

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <CatalogsToolbar
        searchValue={filters.search}
        onSearchChange={(value) => updateFilters({ search: value })}
        onCreateClick={catalogDialog.openCreate}
      />

      {/* Error state */}
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="flex items-center justify-between gap-2">
            <span>{state.error.error.message}</span>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={reload}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {/* Loading state */}
      {state.isLoading && state.isInitialLoad ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Loading catalogs...
        </div>
      ) : null}

      {/* Empty state */}
      {!state.isLoading && !hasResults ? (
        <CatalogsEmptyState
          hasSearch={hasSearch}
          onResetFilters={resetFilters}
          onCreateClick={catalogDialog.openCreate}
        />
      ) : null}

      {/* Table */}
      {hasResults ? (
        <CatalogsTable
          catalogs={state.items}
          isLoading={state.isLoading}
          deletingCatalogId={deleteDialog.state.isDeleting ? deleteDialog.state.catalog?.id ?? null : null}
          onEdit={catalogDialog.openEdit}
          onDelete={deleteDialog.open}
        />
      ) : null}

      {/* Pagination */}
      {hasResults ? (
        <CatalogsPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}

      {/* Create/Edit Dialog */}
      <CatalogDialog
        state={catalogDialog.state}
        onClose={catalogDialog.close}
        onSubmit={catalogDialog.submit}
        onFieldChange={catalogDialog.setFormField}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteCatalogDialog
        state={deleteDialog.state}
        onClose={deleteDialog.close}
        onConfirm={deleteDialog.confirm}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// CatalogsToolbar
// ---------------------------------------------------------------------------

interface CatalogsToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onCreateClick: () => void
}

function CatalogsToolbar({
  searchValue,
  onSearchChange,
  onCreateClick,
}: CatalogsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <Input
          type="search"
          placeholder="Search catalogs..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
          aria-label="Search catalogs"
        />
      </div>
      <Button
        type="button"
        onClick={onCreateClick}
        className="gap-2"
        aria-label="Create new catalog"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        New Catalog
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CatalogsEmptyState
// ---------------------------------------------------------------------------

interface CatalogsEmptyStateProps {
  hasSearch: boolean
  onResetFilters: () => void
  onCreateClick: () => void
}

function CatalogsEmptyState({
  hasSearch,
  onResetFilters,
  onCreateClick,
}: CatalogsEmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <p>No catalogs match your search.</p>
        <Button
          type="button"
          variant="ghost"
          className="px-2 text-xs"
          onClick={onResetFilters}
        >
          Clear search
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <p>You haven&apos;t created any catalogs yet.</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Catalogs help you organize prompts into groups for easier management.
      </p>
      <Button
        type="button"
        variant="ghost"
        className="mt-1 px-2 text-xs font-medium underline underline-offset-2"
        onClick={onCreateClick}
      >
        Create your first catalog
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CatalogsTable
// ---------------------------------------------------------------------------

interface CatalogsTableProps {
  catalogs: CatalogListItemVm[]
  isLoading: boolean
  deletingCatalogId: string | null
  onEdit: (catalog: CatalogListItemVm) => void
  onDelete: (catalog: CatalogListItemVm) => void
}

function CatalogsTable({
  catalogs,
  isLoading,
  deletingCatalogId,
  onEdit,
  onDelete,
}: CatalogsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300"
              >
                Name
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 md:table-cell"
              >
                Description
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 lg:table-cell"
              >
                Created
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 lg:table-cell"
              >
                Updated
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={isLoading && !deletingCatalogId ? "opacity-50" : ""}>
            {catalogs.map((catalog) => {
              const isDeleting = deletingCatalogId === catalog.id
              return (
                <tr
                  key={catalog.id}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {catalog.name}
                    </div>
                    {/* Show description on mobile */}
                    {catalog.description ? (
                      <div className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400 md:hidden">
                        {catalog.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden max-w-xs px-4 py-3 md:table-cell">
                    {catalog.description ? (
                      <span className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                        {catalog.description}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400 lg:table-cell">
                    {catalog.createdAtLabel}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400 lg:table-cell">
                    {catalog.updatedAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        onClick={() => onEdit(catalog)}
                        aria-label={`Edit catalog ${catalog.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={isDeleting}
                        onClick={() => onDelete(catalog)}
                        aria-label={`Delete catalog ${catalog.name}`}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CatalogsPagination
// ---------------------------------------------------------------------------

interface CatalogsPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function CatalogsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: CatalogsPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} catalogs
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span>
          Page {page} of {maxPage}
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={page >= maxPage}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CatalogDialog (Create/Edit)
// ---------------------------------------------------------------------------

interface CatalogDialogProps {
  state: CatalogDialogState
  onClose: () => void
  onSubmit: () => Promise<void>
  onFieldChange: (field: keyof CatalogFormData, value: string) => void
}

function CatalogDialog({
  state,
  onClose,
  onSubmit,
  onFieldChange,
}: CatalogDialogProps) {
  const { open, mode, formData, isSubmitting, fieldErrors, formError } = state

  const title = mode === "create" ? "New Catalog" : "Edit Catalog"
  const description =
    mode === "create"
      ? "Create a new catalog to organize your prompts."
      : "Update the catalog details."

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void onSubmit()
  }

  const nameError = fieldErrors.name?.[0]
  const descriptionError = fieldErrors.description?.[0]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="catalog-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="catalog-name"
                type="text"
                placeholder="Enter catalog name"
                value={formData.name}
                onChange={(e) => onFieldChange("name", e.target.value)}
                maxLength={CATALOG_NAME_MAX_LENGTH}
                disabled={isSubmitting}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "catalog-name-error" : undefined}
                autoFocus
              />
              {nameError ? (
                <p
                  id="catalog-name-error"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {nameError}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formData.name.length}/{CATALOG_NAME_MAX_LENGTH} characters
                </p>
              )}
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <Label htmlFor="catalog-description">
                Description{" "}
                <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
              </Label>
              <Textarea
                id="catalog-description"
                placeholder="Enter a description for this catalog"
                value={formData.description}
                onChange={(e) => onFieldChange("description", e.target.value)}
                maxLength={CATALOG_DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                rows={3}
                aria-invalid={!!descriptionError}
                aria-describedby={
                  descriptionError ? "catalog-description-error" : undefined
                }
              />
              {descriptionError ? (
                <p
                  id="catalog-description-error"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {descriptionError}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formData.description.length}/{CATALOG_DESCRIPTION_MAX_LENGTH}{" "}
                  characters
                </p>
              )}
            </div>

            {/* Form-level error */}
            {formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {formError}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// DeleteCatalogDialog
// ---------------------------------------------------------------------------

interface DeleteCatalogDialogProps {
  state: DeleteCatalogDialogState
  onClose: () => void
  onConfirm: () => Promise<void>
}

function DeleteCatalogDialog({
  state,
  onClose,
  onConfirm,
}: DeleteCatalogDialogProps) {
  const { open, catalog, isDeleting } = state

  const handleConfirm = () => {
    void onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Catalog</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this catalog?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {catalog ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              You are about to delete{" "}
              <span className="font-semibold">&quot;{catalog.name}&quot;</span>.
            </p>
          ) : null}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p>
              Deleting this catalog will unassign it from all associated prompts.
              The prompts themselves will not be deleted.
            </p>
          </div>

          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

