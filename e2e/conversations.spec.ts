import { test, expect } from '@playwright/test'

test.describe('Conversations (History) Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/conversations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-1',
              preview: 'Find my latest photos',
              messageCount: 4,
              updatedAt: '2026-03-14T12:00:00Z',
            },
            {
              id: 'conv-2',
              preview: 'Play some jazz music',
              messageCount: 2,
              updatedAt: '2026-03-13T09:00:00Z',
            },
          ],
        }),
      })
    })
    await page.goto('/conversations')
  })

  test('shows page title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Conversations')
  })

  test('has New Chat button', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'New Chat' })
    await expect(btn).toBeVisible()
  })

  test('lists conversation entries', async ({ page }) => {
    await expect(page.locator('text=Find my latest photos')).toBeVisible()
    await expect(page.locator('text=Play some jazz music')).toBeVisible()
    await expect(page.locator('text=4 messages')).toBeVisible()
    await expect(page.locator('text=2 messages')).toBeVisible()
  })

  test('clicking a conversation navigates to chat', async ({ page }) => {
    // Mock the chat API for the conversation load
    await page.route('**/api/conversations/conv-1', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conv-1',
          messages: [
            { role: 'user', text: 'Find my latest photos' },
            { role: 'assistant', text: 'Here are your recent photos.' },
          ],
          created_at: '2026-03-14T10:00:00Z',
          updated_at: '2026-03-14T12:00:00Z',
        }),
      })
    })

    await page.locator('text=Find my latest photos').click()
    await expect(page).toHaveURL(/\/chat\/conv-1/)
  })

  test('New Chat button navigates to root', async ({ page }) => {
    await page.locator('button', { hasText: 'New Chat' }).click()
    await expect(page).toHaveURL('/')
  })

  test('shows empty state when no conversations', async ({ page }) => {
    await page.route('**/api/conversations*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      })
    })
    await page.goto('/conversations')
    await expect(page.locator('text=No conversations yet')).toBeVisible()
  })
})
