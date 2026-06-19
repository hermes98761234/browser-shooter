import { test, expect } from '@playwright/test'
import { startSingleplayer, clickButton } from './helpers'

test('B opens the buy menu showing the team catalog', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page, 'Counter-Terrorist')
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  // CT-only weapon is offered; the T-only weapon is filtered out.
  await expect(page.getByRole('button', { name: /M4/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /AK-47/ })).toHaveCount(0)
})

test('buying a primary equips it and the menu stays open', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page, 'Counter-Terrorist')
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await clickButton(page, /M4/)
  // Purchasing does not auto-close the menu (you can buy several items).
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).not.toBeVisible()
  // The equipped primary is now shown on the HUD.
  await expect(page.getByText('M4', { exact: true })).toBeVisible()
})

test('the Grenades section is offered and a grenade is buyable', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page, 'Counter-Terrorist')
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await expect(page.getByText('Grenades')).toBeVisible()
  // Flashbangs stack to two; the button shows the carry count and stays buyable.
  const flash = page.getByRole('button', { name: /Flashbang/ })
  await expect(flash).toContainText('0/2')
  await flash.dispatchEvent('click')
  await expect(flash).toContainText('1/2')
})

test('the Equipment section offers team-specific gear', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page, 'Counter-Terrorist')
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await expect(page.getByText('Equipment')).toBeVisible()
  // CT can buy the defuse kit; the T-only C4 is filtered out.
  await expect(page.getByRole('button', { name: /Defuse Kit/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /C4 Bomb/ })).toHaveCount(0)
})

test('B closes the buy menu again', async ({ page }) => {
  await page.goto('/')
  await startSingleplayer(page)
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).not.toBeVisible()
})
