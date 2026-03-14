import { test, expect } from '@playwright/test'

test.describe('Media Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for media page
    await page.route('**/api/files?*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [], total: 0, limit: 200, offset: 0 }),
      })
    })
    await page.route('**/api/playlists', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ playlists: [] }),
      })
    })
    await page.goto('/media')
  })

  test('renders three media tabs', async ({ page }) => {
    const tabs = page.locator('button', { hasText: /Videos|Music|Photos/ })
    await expect(tabs).toHaveCount(3)
  })

  test('Videos tab is active by default', async ({ page }) => {
    const videosTab = page.locator('button', { hasText: 'Videos' })
    await expect(videosTab).toHaveClass(/bg-gray-700/)
  })

  test('switches to Music tab and shows playlist section', async ({ page }) => {
    await page.locator('button', { hasText: 'Music' }).click()
    await expect(page.locator('h2', { hasText: 'Playlists' })).toBeVisible()
    await expect(page.locator('text=+ New Playlist')).toBeVisible()
  })

  test('switches to Photos tab', async ({ page }) => {
    await page.locator('button', { hasText: 'Photos' }).click()
    const photosTab = page.locator('button', { hasText: 'Photos' })
    await expect(photosTab).toHaveClass(/bg-gray-700/)
  })

  test('has a search filter input', async ({ page }) => {
    const filterInput = page.locator('input[placeholder="Filter..."]')
    await expect(filterInput).toBeVisible()
  })

  test('shows empty state when no files', async ({ page }) => {
    await expect(page.locator('text=No videos found')).toBeVisible()
  })

  test('renders video files when available', async ({ page }) => {
    // Re-route with mock video data
    await page.route('**/api/files?*', route => {
      const url = route.request().url()
      if (url.includes('type=video')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'v1', name: 'movie.mp4', type: 'video', size: 1024000,
                modified: '2026-03-14T10:00:00Z', renderType: 'video_card',
                streamUrl: '/api/stream/v1', thumbUrl: '/api/thumb/v1',
                duration: 7200,
              },
            ],
            total: 1, limit: 200, offset: 0,
          }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], total: 0, limit: 200, offset: 0 }),
        })
      }
    })

    await page.goto('/media')
    await expect(page.locator('text=movie.mp4')).toBeVisible()
    // Duration should show "2:00:00"
    await expect(page.locator('text=2:00:00')).toBeVisible()
  })

  test('renders audio files with artist/album', async ({ page }) => {
    await page.route('**/api/files?*', route => {
      const url = route.request().url()
      if (url.includes('type=audio')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files: [
              {
                id: 'a1', name: 'song.mp3', type: 'audio', size: 5000,
                modified: '2026-03-14T10:00:00Z', renderType: 'audio_player',
                streamUrl: '/api/stream/a1', thumbUrl: '/api/thumb/a1',
                artist: 'Test Artist', album: 'Test Album',
              },
            ],
            total: 1, limit: 200, offset: 0,
          }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ files: [], total: 0, limit: 200, offset: 0 }),
        })
      }
    })

    await page.goto('/media')
    await page.locator('button', { hasText: 'Music' }).click()
    await expect(page.locator('text=song.mp3')).toBeVisible()
    await expect(page.locator('text=Test Artist')).toBeVisible()
    await expect(page.locator('text=Test Album')).toBeVisible()
  })
})
