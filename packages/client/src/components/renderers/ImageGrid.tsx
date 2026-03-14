import { useState } from 'react'
import type { FileItem } from '@magpie/shared'
import { ImageLightbox } from '../ImageLightbox'

export function ImageGrid({ items }: { items: FileItem[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
        {items.map((item, i) => (
          <img
            key={item.id}
            src={item.thumbUrl}
            alt={item.name}
            className="w-full aspect-square object-cover cursor-pointer hover:opacity-80 transition"
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          item={items[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(i => i! - 1) : undefined}
          onNext={lightboxIndex < items.length - 1 ? () => setLightboxIndex(i => i! + 1) : undefined}
        />
      )}
    </>
  )
}
