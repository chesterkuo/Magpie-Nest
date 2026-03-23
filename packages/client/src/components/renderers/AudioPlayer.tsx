import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { FileItem } from '@magpie/shared'
import { usePlayback } from '../../hooks/usePlayback'

export function AudioPlayer({ item }: { item: FileItem }) {
  const { play, addToQueue, currentTrack, isPlaying, togglePlay } = usePlayback()
  const isCurrent = currentTrack?.id === item.id

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-white border border-[#E5E5EA] hover:bg-[#F5F5F7] transition-colors ${isCurrent ? 'border-l-2 border-[#007AFF]' : ''}`}>
      <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded bg-[#E5E5EA] object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-[#1D1D1F]">{item.name}</p>
        {(item.artist || item.album) && (
          <p className="text-xs text-[#6E6E73] truncate">
            {item.artist}{item.artist && item.album ? ' — ' : ''}{item.album}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => isCurrent ? togglePlay() : play(item)}
          className="bg-[#007AFF] text-white rounded-full p-2.5 hover:bg-[#0066CC] transition-colors"
          aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
        >
          {isCurrent && isPlaying
            ? <PauseIcon className="w-4 h-4 text-white" />
            : <PlayIcon className="w-4 h-4 text-white" />
          }
        </button>
        {!isCurrent && (
          <button
            onClick={() => addToQueue(item)}
            className="text-[#6E6E73] hover:text-[#007AFF] transition-colors"
            aria-label="Add to queue"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
