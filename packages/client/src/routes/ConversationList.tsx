import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
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
          className="px-3 py-1 bg-blue-600 rounded text-sm"
        >
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
          className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
        >
          <p className="text-sm truncate">{c.preview || 'Empty conversation'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {c.messageCount} messages · {new Date(c.updatedAt).toLocaleDateString()}
          </p>
        </button>
      ))}
    </div>
  )
}
