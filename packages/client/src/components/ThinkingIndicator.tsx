import { Spinner } from './ui/Spinner'

export function ThinkingIndicator({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
      <Spinner className="w-4 h-4" />
      <span>Using {tool}...</span>
    </div>
  )
}
