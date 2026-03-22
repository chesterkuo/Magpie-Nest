import { useEffect, useCallback } from 'react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { FileItem } from '@magpie/shared'

interface Props {
  item: FileItem
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export function ImageLightbox({ item, onClose, onPrev, onNext }: Props) {
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && onPrev) onPrev()
    if (e.key === 'ArrowRight' && onNext) onNext()
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <XMarkIcon className="w-8 h-8" />
      </button>
      {onPrev && (
        <button
          className="absolute left-4 text-white hover:text-gray-300 transition-colors"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          aria-label="Previous image"
        >
          <ChevronLeftIcon className="w-10 h-10" />
        </button>
      )}
      <img
        src={`/api/file/${item.id}?token=${token}`}
        alt={item.name}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {onNext && (
        <button
          className="absolute right-4 text-white hover:text-gray-300 transition-colors"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          aria-label="Next image"
        >
          <ChevronRightIcon className="w-10 h-10" />
        </button>
      )}
      <p className="absolute bottom-4 text-white text-sm">{item.name}</p>
    </div>
  )
}
