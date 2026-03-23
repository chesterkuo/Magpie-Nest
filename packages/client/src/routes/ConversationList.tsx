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
        <h1 className="text-lg text-[#1D1D1F] font-semibold">Conversations</h1>
        <button
          onClick={() => navigate('/')}
          aria-label="New Chat"
          className="flex items-center gap-1.5 bg-[#007AFF] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#0056CC] transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>
      {conversations.length === 0 && (
        <p className="text-[#6E6E73] text-sm">No conversations yet</p>
      )}
      {conversations.map(c => (
        <button
          key={c.id}
          onClick={() => navigate(`/chat/${c.id}`)}
          className="w-full text-left bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <p className="text-sm text-[#6E6E73] truncate">{c.preview || 'Empty conversation'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-[#86868B]">{c.messageCount} messages</span>
            <span className="text-xs text-[#86868B]">·</span>
            <span className="text-xs text-[#86868B]">{new Date(c.updatedAt).toLocaleDateString()}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
