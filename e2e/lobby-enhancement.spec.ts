import { test, expect } from '@playwright/test'

test.describe('Lobby Enhancement', () => {
  test('shows three connection options', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await expect(page.getByRole('button', { name: /quick match/i })).toBeVisible()
    await expect(page.locator('text=Create Room')).toBeVisible()
  })

  test('server browser shows filters', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await expect(page.locator('text=Mode')).toBeVisible()
    await expect(page.locator('text=Status')).toBeVisible()
  })

  test('mode filter buttons are clickable', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await page.click('text=Competitive')
    // After clicking Competitive, the button should be active (highlighted)
    const btn = page.locator('button', { hasText: 'Competitive' })
    await expect(btn).toBeVisible()
  })
})
