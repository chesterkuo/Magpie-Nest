import { test, expect } from '@playwright/test'

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock health and settings endpoints
    await page.route('**/api/health', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          services: {
            llm: { status: 'ok', model: 'qwen3:8b', loaded: true, provider: 'ollama' },
            embedding: { status: 'ok', model: 'nomic-embed-text', provider: 'ollama' },
            lancedb: { status: 'ok', totalChunks: 500 },
            sqlite: { status: 'ok', totalFiles: 42 },
            whisper: { status: 'ok' },
            kokoro: { status: 'ok' },
          },
          uptime: 3600,
          version: '1.0.0',
        }),
      })
    })
    await page.route('**/api/settings', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            watchDirs: ['/data/files'],
            indexing: { queueLength: 0, totalIndexed: 42, lastIndexedAt: '2026-03-14T10:00:00Z' },
            llm: { provider: 'ollama', apiKey: '', baseUrl: '', model: 'qwen3:8b', ollamaHost: 'http://localhost:11434' },
            embedding: { provider: 'ollama', apiKey: '', baseUrl: '', model: 'nomic-embed-text', ollamaHost: 'http://localhost:11434', dimensions: 768 },
            version: '1.0.0',
          }),
        })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
    })
    await page.goto('/settings')
  })

  test('shows page title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Settings')
  })

  test('displays system status section', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'System Status' })).toBeVisible()
    await expect(page.getByText('ok', { exact: true })).toBeVisible()
    await expect(page.getByText('qwen3:8b')).toBeVisible()
    await expect(page.getByText('Indexed: 42')).toBeVisible()
    await expect(page.getByText('Queue: 0')).toBeVisible()
  })

  test('displays watch directories', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Watch Directories' })).toBeVisible()
    await expect(page.getByText('/data/files')).toBeVisible()
  })

  test('has add directory input and button', async ({ page }) => {
    const input = page.locator('input[placeholder="/path/to/watch"]')
    await expect(input).toBeVisible()
    const addBtn = page.locator('button', { hasText: 'Add' })
    await expect(addBtn).toBeVisible()
  })

  test('has Re-index and Remove buttons for watch dirs', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Re-index' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Remove' })).toBeVisible()
  })

  test('displays voice settings section', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Voice' })).toBeVisible()
    await expect(page.locator('text=Read responses aloud')).toBeVisible()
    // Voice toggle is now a custom ToggleSwitch button, not a checkbox
    const toggle = page.locator('button[type="button"]').filter({ has: page.locator('span.rounded-full') })
    await expect(toggle.first()).toBeVisible()
  })

  test('displays Chat Model and Embedding Model sections', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Chat Model' })).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Embedding Model' })).toBeVisible()
  })

  test('displays about section', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'About' })).toBeVisible()
    await expect(page.locator('text=Plusblocks Technology Ltd.')).toBeVisible()
  })
})
