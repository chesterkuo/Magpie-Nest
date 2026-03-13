import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import type { FileItem } from '@magpie/shared'

type LoopMode = 'off' | 'all' | 'one'

interface PlaybackState {
  currentTrack: FileItem | null
  queue: FileItem[]
  queueIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  shuffled: boolean
  loopMode: LoopMode
}

interface PlaybackActions {
  play: (item: FileItem) => void
  playAll: (items: FileItem[]) => void
  addToQueue: (item: FileItem) => void
  next: () => void
  prev: () => void
  toggleShuffle: () => void
  cycleLoop: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (vol: number) => void
}

type PlaybackCtx = PlaybackState & PlaybackActions

const PlaybackContext = createContext<PlaybackCtx | null>(null)

export function usePlayback() {
  const ctx = useContext(PlaybackContext)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [queue, setQueue] = useState<FileItem[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffled, setShuffled] = useState(false)
  const [loopMode, setLoopMode] = useState<LoopMode>('off')

  const currentTrack = queue[queueIndex] || null
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    audio.src = `/api/file/${currentTrack.id}?token=${token}`
    audio.load()
    if (isPlaying) audio.play().catch(() => {})
  }, [currentTrack?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setProgress(audio.currentTime)
    const onDuration = () => setDuration(audio.duration)
    const onEnded = () => {
      if (loopMode === 'one') { audio.currentTime = 0; audio.play(); return }
      if (queueIndex < queue.length - 1) { setQueueIndex(i => i + 1) }
      else if (loopMode === 'all') { setQueueIndex(0) }
      else { setIsPlaying(false) }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [queueIndex, queue.length, loopMode])

  const play = useCallback((item: FileItem) => {
    setQueue([item]); setQueueIndex(0); setIsPlaying(true)
  }, [])

  const playAll = useCallback((items: FileItem[]) => {
    setQueue(shuffled ? shuffleArray(items) : items); setQueueIndex(0); setIsPlaying(true)
  }, [shuffled])

  const addToQueue = useCallback((item: FileItem) => {
    setQueue(q => [...q, item])
  }, [])

  const next = useCallback(() => {
    if (queueIndex < queue.length - 1) setQueueIndex(i => i + 1)
    else if (loopMode === 'all') setQueueIndex(0)
  }, [queueIndex, queue.length, loopMode])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    if (queueIndex > 0) setQueueIndex(i => i - 1)
  }, [queueIndex])

  const toggleShuffle = useCallback(() => {
    setShuffled(s => {
      if (!s) setQueue(q => shuffleArray(q))
      return !s
    })
  }, [])

  const cycleLoop = useCallback(() => {
    setLoopMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
    setIsPlaying(p => !p)
  }, [isPlaying])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = time
  }, [])

  const setVolume = useCallback((vol: number) => {
    const audio = audioRef.current
    if (audio) audio.volume = vol
  }, [])

  return (
    <PlaybackContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, progress, duration,
      shuffled, loopMode, play, playAll, addToQueue, next, prev,
      toggleShuffle, cycleLoop, togglePlay, seek, setVolume,
    }}>
      <audio ref={audioRef} />
      {children}
    </PlaybackContext.Provider>
  )
}
