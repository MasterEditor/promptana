import PromptCreateView from "./PromptCreateView"

export default function NewPromptPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create New Prompt</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create a new prompt with content and metadata. Your prompt will be saved
          with an initial version.
        </p>
      </div>
      <PromptCreateView />
    </div>
  )
}

