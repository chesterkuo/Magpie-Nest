import type { Message } from '../hooks/useSSE'
import { ThinkingIndicator } from './ThinkingIndicator'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`max-w-[85%] ${msg.role === 'user' ? 'self-end bg-blue-600 rounded-2xl rounded-br-sm px-4 py-2' : ''}`}
        >
          {msg.role === 'user' ? (
            <p className="text-sm">{msg.text}</p>
          ) : (
            <div className="space-y-2">
              {msg.thinking && <ThinkingIndicator tool={msg.thinking} />}
              {msg.items && msg.items.length > 0 && (
                <div className="space-y-2">
                  {msg.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-gray-800 rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.type} &middot; {formatSize(item.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {msg.text && <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
