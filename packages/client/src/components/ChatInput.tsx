import { useState } from 'react'
import { VoiceInput } from './VoiceInput'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  function handleTranscript(transcript: string) {
    onSend(transcript)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-800 bg-gray-900">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask Magpie anything..."
        disabled={disabled}
        className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
      />
      <VoiceInput onTranscript={handleTranscript} disabled={disabled} />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium disabled:opacity-40"
      >
        Send
      </button>
    </form>
  )
}
