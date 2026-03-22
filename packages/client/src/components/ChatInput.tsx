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
    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-800 bg-gray-900">
      <div className="flex items-end gap-2 border border-gray-700 rounded-xl bg-gray-800/50 focus-within:border-blue-500 transition-colors px-3 py-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask Magpie anything..."
          disabled={disabled}
          className="flex-1 bg-transparent resize-none text-sm text-white placeholder-gray-500 outline-none leading-6 max-h-48 overflow-y-auto"
        />
        <div className="flex items-center gap-1 shrink-0">
          <VoiceInput onTranscript={handleTranscript} disabled={disabled} />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </form>
  )
}
