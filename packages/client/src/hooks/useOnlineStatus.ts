import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Periodic health check
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        setOnline(res.ok)
      } catch {
        setOnline(false)
      }
    }, 30000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [])

  return online
}
