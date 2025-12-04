'use client'

import { usePathname, useRouter } from "next/navigation"

import type { NavSectionId } from "../view-types"

const mobileSections: { id: NavSectionId; label: string; href: string }[] = [
  { id: "prompts", label: "Prompts", href: "/prompts" },
  { id: "search", label: "Search", href: "/search" },
  { id: "settings", label: "Settings", href: "/settings" },
]

export function MobileNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex h-12 items-center justify-around border-t border-zinc-200 bg-white text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 md:hidden">
      {mobileSections.map((item) => {
        const isActive = pathname === item.href

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(item.href)}
            className={`flex flex-1 items-center justify-center gap-1 ${
              isActive
                ? "font-semibold text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}


