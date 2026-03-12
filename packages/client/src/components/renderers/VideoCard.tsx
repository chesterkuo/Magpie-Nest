import { useRef, useState } from 'react'
import Hls from 'hls.js'
import type { FileItem } from '@magpie/shared'

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
        <button onClick={handlePlay} className="w-full text-left p-3 flex items-center gap-3">
          <img src={item.thumbUrl} alt="" className="w-24 h-16 object-cover rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
          </div>
          <span className="text-2xl">&#9654;</span>
        </button>
      ) : (
        <video ref={videoRef} controls className="w-full" />
      )}
    </div>
  )
}
