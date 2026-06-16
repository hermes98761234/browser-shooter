import { test, expect } from '@playwright/test'
import { startSingleplayer, buyItem } from './helpers'

test('number keys switch between a bought primary and the pistol', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page, 'Counter-Terrorist')
  await expect(page.getByText('Pistol')).toBeVisible()

  await buyItem(page, /M4/)

  await page.keyboard.press('Digit1') // primary slot
  await expect(page.getByText('M4', { exact: true })).toBeVisible()

  await page.keyboard.press('Digit2') // secondary slot
  await expect(page.getByText('Pistol')).toBeVisible()
})
