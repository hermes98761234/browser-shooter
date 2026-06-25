import { test, expect } from '@playwright/test'
import { startSingleplayer, clickButton } from './helpers'

test.describe('Game - Load and Flow', () => {
  test('loads and shows main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByRole('button', { name: 'SINGLEPLAYER' })).toBeVisible()
    await expect(page.getByText('3D FPS Arena Wave Survival')).toBeVisible()
  })

  test('lets you choose a side and starts the match', async ({ page }) => {
    await page.goto('/')
    await clickButton(page, 'SINGLEPLAYER')
    await expect(page.getByText('CHOOSE YOUR SIDE')).toBeVisible()
    await clickButton(page, 'Terrorist', true)
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('WAVE')).toBeVisible()
    await expect(page.getByText('HP')).toBeVisible()
  })

  test('shows HUD elements during gameplay', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await expect(page.getByText('Pistol')).toBeVisible()
    // The crosshair is a canvas drawn by <Crosshair> (CANVAS = 220px).
    await expect(page.locator('canvas[width="220"]')).toBeVisible()
  })

  test('shows minimap during gameplay', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    const minimap = page.locator('canvas[width="150"]')
    await expect(minimap).toBeVisible()
  })

  test('pauses game with Escape key', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'RESUME' })).toBeVisible()
  })

  test('resumes game from pause', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await clickButton(page, 'RESUME')
    await expect(page.getByText('PAUSED')).not.toBeVisible()
  })

  test('returns to main menu from pause', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await clickButton(page, 'MAIN MENU')
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByRole('button', { name: 'SINGLEPLAYER' })).toBeVisible()
  })

  test('can start a fresh match again from the main menu', async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await expect(page.getByText('SCORE')).toBeVisible()
    await page.keyboard.press('Escape')
    await clickButton(page, 'MAIN MENU')
    await expect(page.getByRole('button', { name: 'SINGLEPLAYER' })).toBeVisible()
    await startSingleplayer(page)
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('WAVE')).toBeVisible()
  })
})
