import { useState, useRef } from 'react'
import { MicrophoneIcon } from '@heroicons/react/24/solid'

interface Props {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function VoiceInput({ onTranscript, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        setProcessing(true)

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('audio', blob, 'recording.webm')

        try {
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          })
          if (res.ok) {
            const { text } = await res.json()
            if (text.trim()) onTranscript(text.trim())
          }
        } finally {
          setProcessing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setRecording(true)

      silenceTimerRef.current = setTimeout(() => stopRecording(), 30000)
    } catch {
      // Microphone permission denied
    }
  }

  function stopRecording() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || processing}
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      className={`p-1.5 rounded-lg transition-colors ${
        recording
          ? 'ring-2 ring-rose-500 animate-pulse bg-rose-600 text-white'
          : processing
          ? 'opacity-50 text-gray-400 cursor-not-allowed'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      <MicrophoneIcon className="w-5 h-5" />
    </button>
  )
}
