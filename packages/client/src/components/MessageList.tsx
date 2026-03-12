import type { Message } from '../hooks/useSSE'
import { ThinkingIndicator } from './ThinkingIndicator'
import { RenderBlock } from './renderers/RenderBlock'

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
              {msg.items && msg.items.length > 0 && <RenderBlock items={msg.items} />}
              {msg.text && <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
