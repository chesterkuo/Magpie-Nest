import { usePlayback } from '../hooks/usePlayback'

export function PlaybackBar() {
  const { currentTrack, isPlaying, progress, duration, togglePlay, next, prev } = usePlayback()

  if (!currentTrack) return null

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-3 py-2">
      <div className="flex items-center gap-3">
        <img src={currentTrack.thumbUrl} alt="" className="w-10 h-10 rounded object-cover bg-gray-700" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentTrack.name}</p>
          <div className="w-full h-1 bg-gray-700 rounded mt-1">
            <div className="h-1 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prev} className="text-gray-400 hover:text-white text-sm">&#9664;</button>
          <button onClick={togglePlay} className="text-white text-sm">
            {isPlaying ? '&#10074;&#10074;' : '&#9654;'}
          </button>
          <button onClick={next} className="text-gray-400 hover:text-white text-sm">&#9654;</button>
        </div>
      </div>
    </div>
  )
}
