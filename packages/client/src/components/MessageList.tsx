import type { Message } from '../hooks/useSSE'
import { ThinkingIndicator } from './ThinkingIndicator'
import { RenderBlock } from './renderers/RenderBlock'

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`animate-in flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'user' ? (
            <div className="self-end max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2">
              <p className="text-sm">{msg.text}</p>
            </div>
          ) : (
            <div className="self-start max-w-[85%] flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold mt-1">
                M
              </div>
              <div className="space-y-2">
                {msg.thinking && <ThinkingIndicator tool={msg.thinking} />}
                {msg.items && msg.items.length > 0 && <RenderBlock items={msg.items} />}
                {msg.text && <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text}</p>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
