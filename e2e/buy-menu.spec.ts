import { test, expect } from '@playwright/test'

test('B opens the buy menu and buying switches weapon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByText('Pistol')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).toBeVisible()
  await page.getByRole('button', { name: /Rifle/ }).click()
  await expect(page.getByText('BUY MENU')).not.toBeVisible()
  await expect(page.getByText('Rifle')).toBeVisible()
})

test('B closes the buy menu again', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).not.toBeVisible()
})
