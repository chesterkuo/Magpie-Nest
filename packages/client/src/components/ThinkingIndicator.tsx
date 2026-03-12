export function ThinkingIndicator({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
      <span className="animate-pulse">Calling {tool}...</span>
    </div>
  )
}
