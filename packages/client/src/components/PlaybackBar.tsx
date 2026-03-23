import { useState } from 'react'
import {
  ArrowsRightLeftIcon,
  BackwardIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  ArrowPathIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/solid'
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
    toggleShuffle, cycleLoop, seek, setVolume,
  } = usePlayback()

  const [volume, setVolumeState] = useState(1)

  if (!currentTrack) return null

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolumeState(vol)
    setVolume(vol)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }

  // repeat icon cycles: off -> all -> one
  const repeatActive = loopMode !== 'off'
  const repeatTitle = loopMode === 'one' ? 'Repeat one' : loopMode === 'all' ? 'Repeat all' : 'Repeat off'

  return (
    <div className="border-t border-[#D2D2D7] bg-white/90 backdrop-blur-xl px-4 py-2">
      <div className="flex items-center gap-2 md:gap-3">

        {/* Album Art */}
        <img
          src={currentTrack.thumbUrl}
          alt=""
          className="w-10 h-10 rounded-md shadow-lg object-cover bg-[#E5E5EA] flex-shrink-0"
        />

        {/* Track Info */}
        <div className="min-w-0 w-20 md:w-28 flex-shrink-0">
          <p className="text-xs font-medium truncate text-[#1D1D1F]">{currentTrack.name}</p>
          {currentTrack.artist && (
            <p className="text-[10px] text-[#6E6E73] truncate">{currentTrack.artist}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            className={`hidden md:block p-2.5 rounded-full hover:bg-black/5 transition-colors ${shuffled ? 'text-[#007AFF]' : 'text-[#6E6E73]'}`}
            title="Shuffle"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={prev}
            aria-label="Previous"
            className="p-2.5 rounded-full hover:bg-black/5 transition-colors text-[#1D1D1F] hover:text-[#007AFF]"
            title="Previous"
          >
            <BackwardIcon className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="p-2.5 rounded-full bg-[#007AFF] text-white hover:bg-[#0056CC] transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <PauseIcon className="w-5 h-5" />
              : <PlayIcon className="w-5 h-5" />
            }
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="p-2.5 rounded-full hover:bg-black/5 transition-colors text-[#1D1D1F] hover:text-[#007AFF]"
            title="Next"
          >
            <ForwardIcon className="w-4 h-4" />
          </button>
          <button
            onClick={cycleLoop}
            aria-label="Repeat"
            className={`hidden md:block relative p-2.5 rounded-full hover:bg-black/5 transition-colors ${repeatActive ? 'text-[#007AFF]' : 'text-[#6E6E73]'}`}
            title={repeatTitle}
          >
            <ArrowPathIcon className="w-4 h-4" />
            {loopMode === 'one' && (
              <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold leading-none">1</span>
            )}
          </button>
        </div>

        {/* Progress Bar + Time */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-[#6E6E73] flex-shrink-0 w-7 text-right">
            {formatTime(progress)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            className="flex-1 accent-[#007AFF] cursor-pointer h-1"
            style={{ minWidth: 0 }}
          />
          <span className="text-[10px] text-[#6E6E73] flex-shrink-0 w-7">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume (desktop only) */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          <SpeakerWaveIcon className="w-4 h-4 text-[#6E6E73]" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 accent-[#007AFF] cursor-pointer h-1"
          />
        </div>

      </div>
    </div>
  )
}
