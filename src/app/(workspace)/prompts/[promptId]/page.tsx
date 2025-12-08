import type { PromptId } from "@/types"

import PromptDetailOverviewView from "../PromptDetailOverviewView"
import PromptDetailRunsView from "../PromptDetailRunsView"
import PromptDetailVersionsView from "../PromptDetailVersionsView"
import PromptDetailTabs from "./PromptDetailTabs"

type PromptDetailTab = "overview" | "runs" | "versions"

type SearchParamsRecord = Record<string, string | string[] | undefined>

function getActiveTab(searchParams: SearchParamsRecord): PromptDetailTab {
  const tab = searchParams.tab
  if (tab === "runs") return "runs"
  if (tab === "versions") return "versions"
  return "overview"
}

export default async function PromptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ promptId: string }>
  searchParams: Promise<SearchParamsRecord>
}) {
  const { promptId } = await params
  const resolvedSearchParams = await searchParams

  const activeTab = getActiveTab(resolvedSearchParams)

  return (
    <div className="space-y-4">
      <PromptDetailTabs promptId={promptId as PromptId} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <PromptDetailOverviewView promptId={promptId as PromptId} />
      ) : null}

      {activeTab === "runs" ? (
        <PromptDetailRunsView
          promptId={promptId as PromptId}
          initialSearchParams={resolvedSearchParams}
        />
      ) : null}

      {activeTab === "versions" ? (
        <PromptDetailVersionsView
          promptId={promptId as PromptId}
          initialSearchParams={resolvedSearchParams}
        />
      ) : null}
    </div>
  )
}

