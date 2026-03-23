import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import type { ConversationSummary } from '@magpie/shared'

type DateGroup = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Older'

function getDateGroup(updatedAt: string): DateGroup {
  const now = new Date()
  const date = new Date(updatedAt)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0 || diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 6) return 'Last 7 Days'
  if (diffDays <= 29) return 'Last 30 Days'
  return 'Older'
}

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older']

const groupI18nKeys: Record<DateGroup, string> = {
  'Today': 'conversations.today',
  'Yesterday': 'conversations.yesterday',
  'Last 7 Days': 'conversations.last7Days',
  'Last 30 Days': 'conversations.last30Days',
  'Older': 'conversations.older',
}

function groupConversations(conversations: ConversationSummary[]) {
  const groups = new Map<DateGroup, ConversationSummary[]>()
  for (const g of GROUP_ORDER) groups.set(g, [])
  for (const c of conversations) {
    groups.get(getDateGroup(c.updatedAt))!.push(c)
  }
  return GROUP_ORDER.map(label => ({
    label,
    items: groups.get(label)!,
  })).filter(g => g.items.length > 0)
}

export function ConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const navigate = useNavigate()
  const { t } = useTranslation()
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<DateGroup>>(
    new Set(['Last 7 Days', 'Last 30 Days', 'Older']),
  )
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetch('/api/conversations?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setConversations(data.conversations || []))
      .catch(() => {})
  }, [token])

  const groups = groupConversations(conversations)

  function toggleCollapse(label: DateGroup) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(items: ConversationSummary[]) {
    const ids = items.map(c => c.id)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelected(new Set())
  }

  async function handleDelete() {
    setShowConfirm(false)
    try {
      await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      setConversations(prev => prev.filter(c => !selected.has(c.id)))
      setSelected(new Set())
      setSelectionMode(false)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="p-4 space-y-2 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg text-[#1D1D1F] font-semibold">{t('conversations.title')}</h1>
        <div className="flex items-center gap-3">
          {conversations.length > 0 && (
            <button
              onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
              className="text-[#007AFF] text-sm font-medium"
            >
              {selectionMode ? t('conversations.done') : t('conversations.select')}
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            aria-label={t('conversations.newChat')}
            className="flex items-center gap-1.5 bg-[#007AFF] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#0056CC] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            {t('conversations.newChat')}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {conversations.length === 0 && (
        <p className="text-[#6E6E73] text-sm">{t('conversations.empty')}</p>
      )}

      {/* Grouped conversations */}
      {groups.map(group => {
        const isCollapsed = collapsed.has(group.label)
        const groupIds = group.items.map(c => c.id)
        const allGroupSelected = groupIds.every(id => selected.has(id))

        return (
          <div key={group.label} className="mb-2">
            {/* Group header */}
            <div className="flex items-center gap-2 py-2 cursor-pointer text-xs font-medium text-[#6E6E73] uppercase tracking-wider">
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={allGroupSelected}
                  onChange={() => toggleSelectAll(group.items)}
                  className="w-5 h-5 accent-[#007AFF] rounded"
                  onClick={e => e.stopPropagation()}
                />
              )}
              <button
                onClick={() => toggleCollapse(group.label)}
                className="flex items-center gap-2 flex-1"
              >
                {isCollapsed ? (
                  <ChevronRightIcon className="w-4 h-4 text-[#86868B] transition-transform" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-[#86868B] transition-transform" />
                )}
                <span>{t(groupI18nKeys[group.label])}</span>
                <span className="text-[#86868B] font-normal normal-case">
                  ({group.items.length})
                </span>
              </button>
            </div>

            {/* Group items */}
            {!isCollapsed && (
              <div className="space-y-2">
                {group.items.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelect(c.id)
                      } else {
                        navigate(`/chat/${c.id}`)
                      }
                    }}
                    className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-5 h-5 accent-[#007AFF] rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#6E6E73] truncate">
                        {c.preview || t('conversations.emptyConversation')}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-[#86868B]">{t('conversations.messages', { count: c.messageCount })}</span>
                        <span className="text-xs text-[#86868B]">&middot;</span>
                        <span className="text-xs text-[#86868B]">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Floating Delete Bar */}
      {selectionMode && selected.size > 0 && (
        <div className="sticky bottom-0 pt-3 pb-1">
          <div className="flex items-center justify-between bg-white rounded-xl shadow-md border border-[#E5E5EA] p-3">
            <span className="text-sm text-[#1D1D1F] font-medium">
              {t('conversations.selected', { count: selected.size })}
            </span>
            <button
              onClick={() => setShowConfirm(true)}
              className="bg-[#FF3B30] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#D32F2F] transition-colors"
            >
              {t('conversations.delete')}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full">
            <h2 className="text-lg text-[#1D1D1F] font-semibold mb-1">
              {t('conversations.deleteConfirm', { count: selected.size })}
            </h2>
            <p className="text-sm text-[#6E6E73] mb-6">{t('conversations.deleteWarning')}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-[#007AFF] text-sm font-medium px-4 py-2"
              >
                {t('conversations.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="bg-[#FF3B30] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#D32F2F] transition-colors"
              >
                {t('conversations.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
