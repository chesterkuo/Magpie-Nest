import { useRef, useEffect } from 'react'
import { useParams } from 'react-router'
import { useSSE } from '../hooks/useSSE'
import { ChatInput } from '../components/ChatInput'
import { MessageList } from '../components/MessageList'

export function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { messages, isLoading, sendMessage } = useSSE(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full md:p-6 p-4">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6E6E73]">
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
