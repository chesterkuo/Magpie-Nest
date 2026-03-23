import { useState, useRef } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { VoiceInput } from './VoiceInput'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleTranscript(transcript: string) {
    onSend(transcript)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!text.trim() || disabled) return
      onSend(text.trim())
      setText('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-[#D2D2D7] bg-[#F5F5F7]">
      <div className="flex items-end gap-2 border border-[#D2D2D7] rounded-xl bg-white focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 shadow-sm transition-all px-3 py-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask Magpie anything..."
          disabled={disabled}
          className="flex-1 bg-transparent resize-none text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none leading-6 max-h-48 overflow-y-auto"
        />
        <div className="flex items-center gap-1 shrink-0">
          <VoiceInput onTranscript={handleTranscript} disabled={disabled} />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            aria-label="Send message"
            className="p-2.5 rounded-lg text-[#007AFF] hover:bg-[#007AFF]/10 disabled:text-[#D2D2D7] disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </form>
  )
}
