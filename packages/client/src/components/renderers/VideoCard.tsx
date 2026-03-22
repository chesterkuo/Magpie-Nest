import { useRef, useState } from 'react'
import Hls from 'hls.js'
import { PlayIcon } from '@heroicons/react/24/solid'
import type { FileItem } from '@magpie/shared'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoCard({ item }: { item: FileItem }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  function handlePlay() {
    const video = videoRef.current!
    if (!playing) {
      if (Hls.isSupported()) {
        const hls = new Hls()
        hls.loadSource(item.streamUrl + '/playlist.m3u8')
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = item.streamUrl + '/playlist.m3u8'
      }
      video.play()
      setPlaying(true)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {!playing ? (
        <button onClick={handlePlay} className="w-full text-left">
          <div className="aspect-video w-full rounded-lg overflow-hidden relative group">
            <img src={item.thumbUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <PlayIcon className="w-12 h-12 text-white" />
            </div>
            {item.duration != null && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                {formatDuration(item.duration)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-2 truncate px-1 pb-1">{item.name}</p>
        </button>
      ) : (
        <video ref={videoRef} controls className="w-full" />
      )}
    </div>
  )
}
