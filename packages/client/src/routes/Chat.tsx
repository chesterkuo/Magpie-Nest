import { useRef, useEffect } from 'react'
import { useSSE } from '../hooks/useSSE'
import { ChatInput } from '../components/ChatInput'
import { MessageList } from '../components/MessageList'

export function Chat() {
  const { messages, isLoading, sendMessage } = useSSE()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-lg">Ask Magpie to find your files</p>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
