import { useState, useRef, useCallback } from 'react'
import { ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(fileList).map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...newFiles])
    uploadFiles(newFiles)
  }, [])

  function uploadFiles(uploadFiles: UploadFile[]) {
    const form = new FormData()
    for (const uf of uploadFiles) form.append('files', uf.file)

    const xhr = new XMLHttpRequest()
    const token = localStorage.getItem('magpie-token') || 'magpie-dev'

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const pct = Math.round((e.loaded / e.total) * 100)
      setFiles(prev => prev.map(f =>
        uploadFiles.some(uf => uf.file === f.file)
          ? { ...f, progress: pct, status: 'uploading' }
          : f
      ))
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        setFiles(prev => prev.map(f =>
          uploadFiles.some(uf => uf.file === f.file)
            ? { ...f, progress: 100, status: 'done' }
            : f
        ))
        setTimeout(() => {
          setFiles(prev => prev.filter(f => f.status !== 'done'))
        }, 3000)
      } else {
        setFiles(prev => prev.map(f =>
          uploadFiles.some(uf => uf.file === f.file)
            ? { ...f, status: 'error', error: 'Upload failed' }
            : f
        ))
      }
    }

    xhr.onerror = () => {
      setFiles(prev => prev.map(f =>
        uploadFiles.some(uf => uf.file === f.file)
          ? { ...f, status: 'error', error: 'Network error' }
          : f
      ))
    }

    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(form)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col h-full md:p-6 p-4">
      <h1 className="text-lg font-semibold text-white mb-4">Upload Files</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <ArrowUpTrayIcon className="w-12 h-12 text-gray-500" />
        <div className="text-center">
          <p className="text-sm text-gray-300">Drop files here or click to browse</p>
          <p className="text-xs text-gray-500 mt-1">Any file type, no size limit</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={`${f.file.name}-${i}`} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{f.file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(f.file.size)}</p>
                {(f.status === 'uploading' || f.status === 'pending') && (
                  <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {f.status === 'done' && <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />}
              {f.status === 'error' && <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" />}
              {f.status === 'uploading' && <span className="text-xs text-gray-400">{f.progress}%</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
