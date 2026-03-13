import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { FileItem } from '@magpie/shared'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

export function PDFViewer({ item }: { item: FileItem }) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const token = localStorage.getItem('magpie-token') || 'magpie-dev'

  useEffect(() => {
    const load = async () => {
      const doc = await pdfjsLib.getDocument({
        url: `/api/file/${item.id}?token=${token}`,
      }).promise
      setPdf(doc)
      setNumPages(doc.numPages)
    }
    load()
  }, [item.id])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const render = async () => {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
      }).promise
    }
    render()
  }, [pdf, currentPage])

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-sm font-medium truncate mb-2">{item.name}</p>
      <canvas ref={canvasRef} className="w-full rounded" />
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2 text-sm">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-40"
          >Prev</button>
          <span>{currentPage} / {numPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-40"
          >Next</button>
        </div>
      )}
    </div>
  )
}
