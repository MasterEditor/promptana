'use client'

import { useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import type { NavItemVm, NavSectionId } from "../view-types"
import { useCatalogNav } from "../_hooks/use-catalog-nav"

const mainSections: { id: NavSectionId; label: string; href: string }[] = [
  { id: "prompts", label: "Prompts", href: "/prompts" },
  { id: "catalogs", label: "Catalogs", href: "/catalogs" },
  { id: "tags", label: "Tags", href: "/tags" },
  { id: "search", label: "Search", href: "/search" },
]

interface SidebarNavProps {
  selectedSection?: NavSectionId
}

export function SidebarNav({ selectedSection }: SidebarNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isCatalogsExpanded, setIsCatalogsExpanded] = useState(true)
  const { items: catalogItems, isLoading: isCatalogsLoading, error } =
    useCatalogNav()

  const navItems: NavItemVm[] = useMemo(() => {
    return mainSections.map((section) => {
      const isActiveFromPath = pathname === section.href
      const isActiveFromSelected = selectedSection === section.id

      return {
        id: section.id,
        label: section.label,
        href: section.href,
        iconName: undefined,
        isActive: isActiveFromSelected || isActiveFromPath,
      }
    })
  }, [pathname, selectedSection])

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950 md:flex">
      <nav
        className="space-y-6 text-sm"
        aria-label="Primary workspace navigation"
      >
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                router.push(item.href)
              }}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors ${
                item.isActive
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2" aria-label="Catalog navigation">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            onClick={() => setIsCatalogsExpanded((prev) => !prev)}
          >
            <span>Catalogs</span>
            <span className="text-[10px]">
              {isCatalogsExpanded ? "▾" : "▸"}
            </span>
          </button>

          {isCatalogsExpanded ? (
            <div className="space-y-1">
              {isCatalogsLoading ? (
                <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Loading catalogs…
                </p>
              ) : error ? (
                <p className="px-2 text-xs text-red-600 dark:text-red-400">
                  Catalogs are temporarily unavailable.
                </p>
              ) : catalogItems.length === 0 ? (
                <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                  No catalogs yet.
                </p>
              ) : (
                catalogItems.map((catalog) => (
                  <button
                    key={catalog.id}
                    type="button"
                    onClick={() => {
                      router.push(catalog.href)
                    }}
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      catalog.isActive
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate">{catalog.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  )
}


