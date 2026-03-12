// packages/server/services/__tests__/watcher.test.ts
import { describe, it, expect, afterEach } from 'bun:test'
import { createWatcher } from '../watcher'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

const TEST_DIR = '/tmp/magpie-watcher-test'

describe('Watcher', () => {
  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }) } catch {}
  })

  it('detects new files', async () => {
    mkdirSync(TEST_DIR, { recursive: true })

    const events: { path: string; event: string }[] = []
    const watcher = createWatcher([TEST_DIR], (path, event) => {
      events.push({ path, event })
    })

    // Wait for watcher to be ready
    await new Promise((r) => setTimeout(r, 500))

    writeFileSync(`${TEST_DIR}/test.txt`, 'hello')

    // Wait for debounce + detection
    await new Promise((r) => setTimeout(r, 2000))

    watcher.close()

    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events.some((e) => e.path.includes('test.txt'))).toBe(true)
  })
})
