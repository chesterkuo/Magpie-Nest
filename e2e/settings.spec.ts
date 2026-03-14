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
          services: { ollama: { status: 'running', model: 'qwen3:8b' } },
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
    await expect(page.getByText('Files indexed: 42')).toBeVisible()
    await expect(page.getByText('0 pending')).toBeVisible()
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
    const checkbox = page.locator('input[type="checkbox"]')
    await expect(checkbox).toBeVisible()
  })

  test('displays authentication section with token', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Authentication' })).toBeVisible()
    await expect(page.locator('text=magpie-dev')).toBeVisible()
  })

  test('displays about section', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'About' })).toBeVisible()
    await expect(page.locator('text=Plusblocks Technology Ltd.')).toBeVisible()
  })
})
