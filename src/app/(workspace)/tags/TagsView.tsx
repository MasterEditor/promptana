'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  useTagsListFilters,
  useTagsListData,
  useTagDialog,
  useDeleteTagDialog,
} from "./hooks"
import type {
  TagDialogState,
  TagFormData,
  TagListItemVm,
  TagsListFiltersVm,
  DeleteTagDialogState,
} from "./view-types"
import { TAG_NAME_MAX_LENGTH } from "./view-types"

interface TagsViewProps {
  initialFilters: TagsListFiltersVm
}

export default function TagsView({ initialFilters }: TagsViewProps) {
  const { filters, updateFilters, resetFilters } = useTagsListFilters(initialFilters)
  const { state, reload } = useTagsListData(filters)

  const tagDialog = useTagDialog(reload)
  const deleteDialog = useDeleteTagDialog(reload)

  const hasResults = state.total > 0
  const hasSearch = filters.search.trim().length > 0

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <TagsToolbar
        searchValue={filters.search}
        onSearchChange={(value) => updateFilters({ search: value })}
        onCreateClick={tagDialog.openCreate}
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
          Loading tags...
        </div>
      ) : null}

      {/* Empty state */}
      {!state.isLoading && !hasResults ? (
        <TagsEmptyState
          hasSearch={hasSearch}
          onResetFilters={resetFilters}
          onCreateClick={tagDialog.openCreate}
        />
      ) : null}

      {/* Table */}
      {hasResults ? (
        <TagsTable
          tags={state.items}
          isLoading={state.isLoading}
          deletingTagId={deleteDialog.state.isDeleting ? deleteDialog.state.tag?.id ?? null : null}
          onEdit={tagDialog.openEdit}
          onDelete={deleteDialog.open}
        />
      ) : null}

      {/* Pagination */}
      {hasResults ? (
        <TagsPagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={(page) => updateFilters({ page })}
        />
      ) : null}

      {/* Create/Edit Dialog */}
      <TagDialog
        state={tagDialog.state}
        onClose={tagDialog.close}
        onSubmit={tagDialog.submit}
        onFieldChange={tagDialog.setFormField}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTagDialog
        state={deleteDialog.state}
        onClose={deleteDialog.close}
        onConfirm={deleteDialog.confirm}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// TagsToolbar
// ---------------------------------------------------------------------------

interface TagsToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onCreateClick: () => void
}

function TagsToolbar({
  searchValue,
  onSearchChange,
  onCreateClick,
}: TagsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <Input
          type="search"
          placeholder="Search tags..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
          aria-label="Search tags"
        />
      </div>
      <Button
        type="button"
        onClick={onCreateClick}
        className="gap-2"
        aria-label="Create new tag"
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
        New Tag
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TagsEmptyState
// ---------------------------------------------------------------------------

interface TagsEmptyStateProps {
  hasSearch: boolean
  onResetFilters: () => void
  onCreateClick: () => void
}

function TagsEmptyState({
  hasSearch,
  onResetFilters,
  onCreateClick,
}: TagsEmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <p>No tags match your search.</p>
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
      <p>You haven&apos;t created any tags yet.</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Tags help you organize and filter prompts for easier discovery.
      </p>
      <Button
        type="button"
        variant="ghost"
        className="mt-1 px-2 text-xs font-medium underline underline-offset-2"
        onClick={onCreateClick}
      >
        Create your first tag
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TagsTable
// ---------------------------------------------------------------------------

interface TagsTableProps {
  tags: TagListItemVm[]
  isLoading: boolean
  deletingTagId: string | null
  onEdit: (tag: TagListItemVm) => void
  onDelete: (tag: TagListItemVm) => void
}

function TagsTable({
  tags,
  isLoading,
  deletingTagId,
  onEdit,
  onDelete,
}: TagsTableProps) {
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
                className="hidden px-4 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300 sm:table-cell"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={isLoading && !deletingTagId ? "opacity-50" : ""}>
            {tags.map((tag) => {
              const isDeleting = deletingTagId === tag.id
              return (
                <tr
                  key={tag.id}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {tag.name}
                    </div>
                    {/* Show created date on mobile */}
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden">
                      {tag.createdAtLabel}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400 sm:table-cell">
                    {tag.createdAtLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        onClick={() => onEdit(tag)}
                        aria-label={`Edit tag ${tag.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={isDeleting}
                        onClick={() => onDelete(tag)}
                        aria-label={`Delete tag ${tag.name}`}
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
// TagsPagination
// ---------------------------------------------------------------------------

interface TagsPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function TagsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: TagsPaginationProps) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      <span>
        Showing {start}–{end} of {total} tags
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
// TagDialog (Create/Edit)
// ---------------------------------------------------------------------------

interface TagDialogProps {
  state: TagDialogState
  onClose: () => void
  onSubmit: () => Promise<void>
  onFieldChange: (field: keyof TagFormData, value: string) => void
}

function TagDialog({
  state,
  onClose,
  onSubmit,
  onFieldChange,
}: TagDialogProps) {
  const { open, mode, formData, isSubmitting, fieldErrors, formError } = state

  const title = mode === "create" ? "New Tag" : "Edit Tag"
  const description =
    mode === "create"
      ? "Create a new tag to organize your prompts."
      : "Update the tag name."

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void onSubmit()
  }

  const nameError = fieldErrors.name?.[0]

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
              <Label htmlFor="tag-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tag-name"
                type="text"
                placeholder="Enter tag name"
                value={formData.name}
                onChange={(e) => onFieldChange("name", e.target.value)}
                maxLength={TAG_NAME_MAX_LENGTH}
                disabled={isSubmitting}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "tag-name-error" : undefined}
                autoFocus
              />
              {nameError ? (
                <p
                  id="tag-name-error"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {nameError}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formData.name.length}/{TAG_NAME_MAX_LENGTH} characters
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
// DeleteTagDialog
// ---------------------------------------------------------------------------

interface DeleteTagDialogProps {
  state: DeleteTagDialogState
  onClose: () => void
  onConfirm: () => Promise<void>
}

function DeleteTagDialog({
  state,
  onClose,
  onConfirm,
}: DeleteTagDialogProps) {
  const { open, tag, isDeleting } = state

  const handleConfirm = () => {
    void onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Tag</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this tag?
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {tag ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              You are about to delete{" "}
              <span className="font-semibold">&quot;{tag.name}&quot;</span>.
            </p>
          ) : null}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p>
              Deleting this tag will disassociate it from all prompts.
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

