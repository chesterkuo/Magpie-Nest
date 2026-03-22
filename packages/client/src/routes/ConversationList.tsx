import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { PlusIcon } from '@heroicons/react/24/solid'
import type { ConversationSummary } from '@magpie/shared'

export function ConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const navigate = useNavigate()
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    fetch('/api/conversations?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setConversations(data.conversations || []))
      .catch(() => {})
  }, [token])

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Conversations</h1>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>
      {conversations.length === 0 && (
        <p className="text-gray-500 text-sm">No conversations yet</p>
      )}
      {conversations.map(c => (
        <button
          key={c.id}
          onClick={() => navigate(`/chat/${c.id}`)}
          className="w-full text-left bg-gray-800 rounded-xl p-4 hover:bg-gray-700/50 transition-colors cursor-pointer"
        >
          <p className="text-sm truncate text-white">{c.preview || 'Empty conversation'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-500">{c.messageCount} messages</span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-500">{new Date(c.updatedAt).toLocaleDateString()}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
