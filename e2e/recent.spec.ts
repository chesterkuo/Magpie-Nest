import { test, expect } from '@playwright/test'

test.describe('Recent Files Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/files?*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            {
              id: 'f1', name: 'report.pdf', type: 'pdf', size: 2048,
              modified: new Date().toISOString(), renderType: 'pdf_preview',
              streamUrl: '/api/stream/f1', thumbUrl: '/api/thumb/f1',
            },
            {
              id: 'f2', name: 'photo.jpg', type: 'image', size: 1024,
              modified: new Date().toISOString(), renderType: 'image_grid',
              streamUrl: '/api/stream/f2', thumbUrl: '/api/thumb/f2',
            },
          ],
          total: 2, limit: 50, offset: 0,
        }),
      })
    })
    await page.goto('/recent')
  })

  test('shows page title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Recent Files')
  })

  test('groups files by date', async ({ page }) => {
    // Files with today's date should be in "Today" group
    await expect(page.locator('h2', { hasText: 'Today' })).toBeVisible()
  })

  test('shows file names', async ({ page }) => {
    await expect(page.locator('text=report.pdf')).toBeVisible()
    // Images render in ImageGrid with alt text, not visible text
    await expect(page.locator('img[alt="photo.jpg"]')).toBeVisible()
  })

  test('shows empty state when no files', async ({ page }) => {
    await page.route('**/api/files?*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], total: 0, limit: 50, offset: 0 }),
      })
    })
    await page.goto('/recent')
    await expect(page.locator('text=No recent files found')).toBeVisible()
  })

  test('shows Load more button when there are more files', async ({ page }) => {
    await page.route('**/api/files?*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [{
            id: 'f1', name: 'a.pdf', type: 'pdf', size: 100,
            modified: new Date().toISOString(), renderType: 'pdf_preview',
            streamUrl: '/api/stream/f1', thumbUrl: '/api/thumb/f1',
          }],
          total: 100, limit: 50, offset: 0,
        }),
      })
    })
    await page.goto('/recent')
    await expect(page.locator('button', { hasText: 'Load more' })).toBeVisible()
  })
})
