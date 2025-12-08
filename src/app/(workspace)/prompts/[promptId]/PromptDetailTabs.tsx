'use client'

import Link from "next/link"

import type { PromptId } from "@/types"

type PromptDetailTab = "overview" | "runs" | "versions"

interface PromptDetailTabsProps {
  promptId: PromptId
  activeTab: PromptDetailTab
}

export default function PromptDetailTabs({
  promptId,
  activeTab,
}: PromptDetailTabsProps) {
  const tabs: { id: PromptDetailTab; label: string; href: string }[] = [
    {
      id: "overview",
      label: "Overview",
      href: `/prompts/${encodeURIComponent(promptId)}`,
    },
    {
      id: "runs",
      label: "Runs",
      href: `/prompts/${encodeURIComponent(promptId)}?tab=runs`,
    },
    {
      id: "versions",
      label: "Versions",
      href: `/prompts/${encodeURIComponent(promptId)}?tab=versions`,
    },
  ]

  return (
    <nav
      className="flex border-b border-zinc-200 dark:border-zinc-800"
      aria-label="Prompt detail tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
