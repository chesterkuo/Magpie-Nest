import { test, expect } from '@playwright/test'

test.describe('Chat Page', () => {
  test('shows empty state prompt', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Ask Magpie to find your files')).toBeVisible()
  })

  test('has chat input with placeholder', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[placeholder="Ask Magpie anything..."]')
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()
  })

  test('has Send button that is disabled when input is empty', async ({ page }) => {
    await page.goto('/')
    const sendBtn = page.locator('button', { hasText: 'Send' })
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeDisabled()
  })

  test('enables Send button when text is entered', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[placeholder="Ask Magpie anything..."]')
    const sendBtn = page.locator('button', { hasText: 'Send' })

    await input.fill('hello')
    await expect(sendBtn).toBeEnabled()
  })

  test('clears input after pressing Enter', async ({ page }) => {
    // Mock the SSE endpoint to avoid connection errors
    await page.route('**/api/chat', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"text","content":"Hello!"}\n\ndata: [DONE]\n\n',
      })
    })

    await page.goto('/')
    const input = page.locator('input[placeholder="Ask Magpie anything..."]')
    await input.fill('hello world')
    await input.press('Enter')

    // Input should be cleared after sending
    await expect(input).toHaveValue('')
  })

  test('has voice input button', async ({ page }) => {
    await page.goto('/')
    // VoiceInput component should render a mic button
    const form = page.locator('form')
    await expect(form).toBeVisible()
    // The form has input + voice button + send button
    const buttons = form.locator('button')
    await expect(buttons).toHaveCount(2) // voice + send
  })
})
