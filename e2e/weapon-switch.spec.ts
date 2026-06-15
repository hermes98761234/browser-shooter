import { test, expect } from '@playwright/test'

test('Tab cycles the active weapon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByText('Pistol')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByText('Shotgun')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByText('Rifle')).toBeVisible()
})
