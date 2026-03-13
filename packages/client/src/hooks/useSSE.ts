import { useState, useCallback, useRef, useEffect } from 'react'
import type { AgentChunk, FileItem, Message } from '@magpie/shared'

export type { Message }

export function useSSE() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const lastAssistantTextRef = useRef('')

  const sendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', text: '', items: [] }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const token = localStorage.getItem('magpie-token') || 'magpie-dev'
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (!data) continue

          try {
            const chunk: AgentChunk = JSON.parse(data)

            setMessages((prev) => {
              const msgs = [...prev]
              const last = { ...msgs[msgs.length - 1] }

              switch (chunk.type) {
                case 'thinking':
                  last.thinking = chunk.tool
                  break
                case 'text':
                  last.text += chunk.content || ''
                  last.thinking = undefined
                  lastAssistantTextRef.current = last.text
                  break
                case 'render':
                  last.items = [...(last.items || []), ...(chunk.items || [])]
                  last.thinking = undefined
                  break
                case 'error':
                  last.text += `\nError: ${chunk.message}`
                  break
              }

              msgs[msgs.length - 1] = last
              return msgs
            })
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          text: `Error: ${err.message}`,
        }
        return msgs
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading || !lastAssistantTextRef.current) return
    if (localStorage.getItem('magpie-tts') !== 'true') return

    const text = lastAssistantTextRef.current
    lastAssistantTextRef.current = ''
    const token = localStorage.getItem('magpie-token') || 'magpie-dev'
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.play().catch(() => {})
          audio.onended = () => URL.revokeObjectURL(url)
        }
      })
      .catch(() => {})
  }, [isLoading])

  return { messages, isLoading, sendMessage }
}
