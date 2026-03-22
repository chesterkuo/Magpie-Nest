import { test, expect } from '@playwright/test'

test.describe('App Shell & Navigation', () => {
  test('loads the app with correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Magpie')
  })

  test('respects system dark mode preference', async ({ page }) => {
    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('renders sidebar navigation with 6 tabs', async ({ page }) => {
    await page.goto('/')
    // At desktop viewport (1280x720), Sidebar is visible inside <aside>
    const nav = page.locator('aside nav')
    await expect(nav).toBeVisible()

    const links = nav.locator('a')
    await expect(links).toHaveCount(6)

    await expect(links.nth(0)).toContainText('Chat')
    await expect(links.nth(1)).toContainText('History')
    await expect(links.nth(2)).toContainText('Recent')
    await expect(links.nth(3)).toContainText('Media')
    await expect(links.nth(4)).toContainText('Upload')
    await expect(links.nth(5)).toContainText('Settings')
  })

  test('Chat tab is active by default on root', async ({ page }) => {
    await page.goto('/')
    const chatLink = page.locator('aside nav a', { hasText: 'Chat' })
    await expect(chatLink).toHaveClass(/bg-gray-800/)
    await expect(chatLink).toHaveClass(/text-white/)
  })

  test('navigates to each tab', async ({ page }) => {
    await page.goto('/')

    // Navigate to History
    await page.locator('aside nav a', { hasText: 'History' }).click()
    await expect(page).toHaveURL(/\/conversations/)
    await expect(page.locator('h1')).toHaveText('Conversations')

    // Navigate to Recent
    await page.locator('aside nav a', { hasText: 'Recent' }).click()
    await expect(page).toHaveURL(/\/recent/)
    await expect(page.locator('h1')).toHaveText('Recent Files')

    // Navigate to Media
    await page.locator('aside nav a', { hasText: 'Media' }).click()
    await expect(page).toHaveURL(/\/media/)

    // Navigate to Upload
    await page.locator('aside nav a', { hasText: 'Upload' }).click()
    await expect(page).toHaveURL(/\/upload/)
    await expect(page.locator('h1')).toHaveText('Upload Files')

    // Navigate to Settings
    await page.locator('aside nav a', { hasText: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.locator('h1')).toHaveText('Settings')

    // Navigate back to Chat
    await page.locator('aside nav a', { hasText: 'Chat' }).click()
    await expect(page).toHaveURL('/')
  })
})
