import { test, expect } from '@playwright/test'
import { startSingleplayer } from './helpers'

test.describe('UI - HUD and Overlays', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('main menu displays title and subtitle', async ({ page }) => {
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByText('3D FPS Arena Wave Survival')).toBeVisible()
  })

  test('main menu SINGLEPLAYER button is clickable', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: 'SINGLEPLAYER' })
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toBeEnabled()
  })

  test('controls section shows key bindings', async ({ page }) => {
    await expect(page.getByText('WASD', { exact: true })).toBeVisible()
    await expect(page.getByText('Move')).toBeVisible()
    await expect(page.getByText('Mouse', { exact: true })).toBeVisible()
    await expect(page.getByText('Look')).toBeVisible()
    await expect(page.getByText('Click', { exact: true })).toBeVisible()
    await expect(page.getByText('Shoot', { exact: true })).toBeVisible()
    await expect(page.getByText('Switch Weapon')).toBeVisible()
    await expect(page.getByText('Space', { exact: true })).toBeVisible()
    await expect(page.getByText('Jump')).toBeVisible()
  })

  test('HUD shows health bar with HP label after starting game', async ({ page }) => {
    await startSingleplayer(page)
    await expect(page.getByText('HP')).toBeVisible()
    await expect(page.getByText('100 / 100')).toBeVisible()
  })

  test('HUD shows score display after starting game', async ({ page }) => {
    await startSingleplayer(page)
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.locator('text=/^0$/').first()).toBeVisible()
  })

  test('HUD shows wave counter after starting game', async ({ page }) => {
    await startSingleplayer(page)
    await expect(page.getByText('WAVE')).toBeVisible()
  })

  test('HUD shows weapon name and ammo after starting game', async ({ page }) => {
    await startSingleplayer(page)
    await expect(page.getByText('Pistol')).toBeVisible()
    await expect(page.getByText('60', { exact: true })).toBeVisible()
  })

  test('HUD shows crosshair during gameplay', async ({ page }) => {
    await startSingleplayer(page)
    // The crosshair is a canvas drawn by <Crosshair> (CANVAS = 220px).
    const crosshair = page.locator('canvas[width="220"]')
    await expect(crosshair).toBeVisible()
  })

  test('minimap is rendered during gameplay', async ({ page }) => {
    await startSingleplayer(page)
    const minimap = page.locator('canvas[width="150"][height="150"]')
    await expect(minimap).toBeVisible()
  })

  test('pause menu shows PAUSED title and buttons', async ({ page }) => {
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'RESUME' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeVisible()
  })

  test('pause menu shows controls reminder', async ({ page }) => {
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('WASD - Move')).toBeVisible()
    await expect(page.getByText('Mouse - Look')).toBeVisible()
    await expect(page.getByText('Click - Shoot')).toBeVisible()
    await expect(page.getByText('R - Reload')).toBeVisible()
    await expect(page.getByText('ESC - Pause')).toBeVisible()
  })

  test('pause menu shows "Press ESC to resume" hint', async ({ page }) => {
    await startSingleplayer(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('Press ESC to resume')).toBeVisible()
  })

  test('wave number is displayed during gameplay', async ({ page }) => {
    await startSingleplayer(page)
    const waveDisplay = page.locator('text=WAVE').first()
    await expect(waveDisplay).toBeVisible()
    await page.waitForTimeout(3000)
    await expect(waveDisplay).toBeVisible()
  })

  test('HUD elements are visible', async ({ page }) => {
    await startSingleplayer(page)
    await expect(page.getByText('SCORE').first()).toBeVisible()
    await expect(page.getByText('HP')).toBeVisible()
  })
})
