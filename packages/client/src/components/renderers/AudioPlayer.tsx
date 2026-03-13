import type { FileItem } from '@magpie/shared'
import { usePlayback } from '../../hooks/usePlayback'

export function AudioPlayer({ item }: { item: FileItem }) {
  const { play, addToQueue, currentTrack, isPlaying, togglePlay } = usePlayback()
  const isCurrent = currentTrack?.id === item.id

  return (
    <div className={`bg-gray-800 rounded-lg p-3 flex items-center gap-3 ${isCurrent ? 'ring-1 ring-blue-500' : ''}`}>
      <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded object-cover bg-gray-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => isCurrent ? togglePlay() : play(item)}
          className="px-3 py-1 bg-blue-600 rounded text-xs font-medium"
        >
          {isCurrent && isPlaying ? 'Pause' : 'Play'}
        </button>
        {!isCurrent && (
          <button
            onClick={() => addToQueue(item)}
            className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-300"
          >+ Queue</button>
        )}
      </div>
    </div>
  )
}
