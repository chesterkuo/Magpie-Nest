import chokidar from 'chokidar'

type WatchCallback = (filePath: string, eventType: 'created' | 'modified' | 'deleted') => void

export function createWatcher(
  directories: string[],
  onEvent: WatchCallback,
  debounceMs = 300
) {
  const timers = new Map<string, Timer>()

  const watcher = chokidar.watch(directories, {
    ignored: /(^|[\/\\])\.|node_modules|\.DS_Store/,
    persistent: true,
    ignoreInitial: false, // Scan existing files on startup to catch AirDrop/offline additions
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  })

  function debounced(filePath: string, eventType: 'created' | 'modified' | 'deleted') {
    const existing = timers.get(filePath)
    if (existing) clearTimeout(existing)

    timers.set(
      filePath,
      setTimeout(() => {
        timers.delete(filePath)
        onEvent(filePath, eventType)
      }, debounceMs)
    )
  }

  watcher
    .on('add', (path) => debounced(path, 'created'))
    .on('change', (path) => debounced(path, 'modified'))
    .on('unlink', (path) => debounced(path, 'deleted'))

  return {
    close() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      return watcher.close()
    },
  }
}
