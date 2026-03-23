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
            <div className="self-end max-w-[80%] bg-[#007AFF] text-white rounded-2xl rounded-br-sm px-4 py-2">
              <p className="text-sm">{msg.text}</p>
            </div>
          ) : (
            <div className="self-start max-w-[85%] flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-bold mt-1">
                M
              </div>
              <div className="space-y-2">
                {msg.thinking && <ThinkingIndicator tool={msg.thinking} />}
                {msg.items && msg.items.length > 0 && (
                  <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm border border-[#E5E5EA] px-4 py-2">
                    <RenderBlock items={msg.items} />
                  </div>
                )}
                {msg.text && (
                  <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm border border-[#E5E5EA] px-4 py-2">
                    <p className="text-sm text-[#1D1D1F] whitespace-pre-wrap">{msg.text}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
