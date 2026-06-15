import { test, expect } from '@playwright/test'

test.describe('Browser Shooter', () => {
  test('loads and shows main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByText('START GAME')).toBeVisible()
    await expect(page.getByText('3D FPS Arena Wave Survival')).toBeVisible()
  })

  test('shows controls info on main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Controls')).toBeVisible()
    await expect(page.getByText('WASD')).toBeVisible()
    await expect(page.getByText('Mouse')).toBeVisible()
  })

  test('starts game when clicking start button', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('WAVE')).toBeVisible()
    await expect(page.getByText('HP')).toBeVisible()
  })

  test('shows HUD elements during gameplay', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await expect(page.getByText('Pistol')).toBeVisible()
    await expect(page.locator('text=/\\d+ \\/ \\d+/')).toBeVisible()
  })

  test('shows minimap during gameplay', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('pauses game with Escape key', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await expect(page.getByText('RESUME')).toBeVisible()
  })

  test('resumes game from pause', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await page.getByText('RESUME').click()
    await expect(page.getByText('PAUSED')).not.toBeVisible()
  })
})
