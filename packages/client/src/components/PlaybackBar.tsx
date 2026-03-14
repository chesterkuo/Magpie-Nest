import { usePlayback } from '../hooks/usePlayback'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlaybackBar() {
  const {
    currentTrack, isPlaying, progress, duration,
    togglePlay, next, prev, shuffled, loopMode,
    toggleShuffle, cycleLoop, seek,
  } = usePlayback()

  if (!currentTrack) return null

  const pct = duration > 0 ? (progress / duration) * 100 : 0
  const loopIcon = loopMode === 'one' ? '\u{1F502}' : loopMode === 'all' ? '\u{1F501}' : '\u27A1\uFE0F'

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-3 py-2">
      <div className="flex items-center gap-2">
        <img src={currentTrack.thumbUrl} alt="" className="w-10 h-10 rounded object-cover bg-gray-700" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentTrack.name}</p>
          {currentTrack.artist && (
            <p className="text-[10px] text-gray-400 truncate">{currentTrack.artist}</p>
          )}
          <div
            className="w-full h-1 bg-gray-700 rounded mt-1 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              seek(ratio * duration)
            }}
          >
            <div className="h-1 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleShuffle}
            className={`text-xs ${shuffled ? 'text-blue-400' : 'text-gray-500'} hover:text-white`}
            title="Shuffle"
          >
            {'\u{1F500}'}
          </button>
          <button onClick={prev} className="text-gray-400 hover:text-white text-sm">{'\u23EE'}</button>
          <button onClick={togglePlay} className="text-white text-lg">
            {isPlaying ? '\u23F8' : '\u25B6\uFE0F'}
          </button>
          <button onClick={next} className="text-gray-400 hover:text-white text-sm">{'\u23ED'}</button>
          <button
            onClick={cycleLoop}
            className={`text-xs ${loopMode !== 'off' ? 'text-blue-400' : 'text-gray-500'} hover:text-white`}
            title={`Loop: ${loopMode}`}
          >
            {loopIcon}
          </button>
        </div>
      </div>
    </div>
  )
}
