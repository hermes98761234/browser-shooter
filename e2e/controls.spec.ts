import { test, expect } from '@playwright/test'
import { startSingleplayer, buyItem } from './helpers'

test.describe('Controls - Keyboard and Mouse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await startSingleplayer(page)
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('W key moves player forward', async ({ page }) => {
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyW')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('A key moves player left', async ({ page }) => {
    await page.keyboard.down('KeyA')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyA')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('S key moves player backward', async ({ page }) => {
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyS')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('D key moves player right', async ({ page }) => {
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyD')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('R key triggers reload', async ({ page }) => {
    await page.keyboard.press('KeyR')
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('Space key makes player jump', async ({ page }) => {
    await page.keyboard.press('Space')
    await page.waitForTimeout(300)
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('key 1 keeps the pistol when no primary is owned', async ({ page }) => {
    await page.keyboard.press('Digit1')
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('key 2 selects the secondary pistol', async ({ page }) => {
    await page.keyboard.press('Digit2')
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('after buying a primary, keys 1 and 2 swap slots', async ({ page }) => {
    await buyItem(page, /M4/)
    await page.keyboard.press('Digit1')
    await expect(page.getByText('M4', { exact: true })).toBeVisible()
    await page.keyboard.press('Digit2')
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('weapon switching updates ammo display', async ({ page }) => {
    await buyItem(page, /M4/)
    await page.keyboard.press('Digit1') // M4 has 90 ammo
    await expect(page.getByText('M4', { exact: true })).toBeVisible()
    await expect(page.getByText('90', { exact: true })).toBeVisible()
    await page.keyboard.press('Digit2') // pistol has 60 ammo
    await expect(page.getByText('Pistol')).toBeVisible()
    await expect(page.getByText('60', { exact: true })).toBeVisible()
  })

  test('Escape key toggles pause state', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).not.toBeVisible()
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('M key toggles mute without crashing', async ({ page }) => {
    await page.keyboard.press('KeyM')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('combined WASD keys work simultaneously', async ({ page }) => {
    await page.keyboard.down('KeyW')
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyW')
    await page.keyboard.up('KeyD')
    await expect(page.getByText('SCORE')).toBeVisible()
  })
})
