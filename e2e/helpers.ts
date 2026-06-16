import { type Page, expect } from '@playwright/test'

/**
 * Click a button by its accessible name.
 *
 * Uses `dispatchEvent('click')` rather than a coordinate click: the Three.js
 * canvas shares the menus' container, so a real mouse click can be hit-tested
 * onto the canvas instead of the button. Dispatching the event straight to the
 * resolved element is deterministic and still triggers React's onClick.
 */
export async function clickButton(page: Page, name: string | RegExp, exact = false) {
  const button = page.getByRole('button', { name, exact })
  await expect(button).toBeVisible()
  await button.dispatchEvent('click')
}

/** Start a singleplayer match: main menu → team select → in-game HUD. */
export async function startSingleplayer(
  page: Page,
  team: 'Counter-Terrorist' | 'Terrorist' = 'Counter-Terrorist',
) {
  await clickButton(page, 'SINGLEPLAYER')
  await expect(page.getByText('CHOOSE YOUR SIDE')).toBeVisible()
  await clickButton(page, team, true)
  await expect(page.getByText('SCORE')).toBeVisible()
}

/** Open the buy menu, purchase an item by its visible button name, then close. */
export async function buyItem(page: Page, name: string | RegExp) {
  await page.keyboard.press('b')
  await expect(page.getByText(/BUY MENU/)).toBeVisible()
  await clickButton(page, name)
  await page.keyboard.press('b') // close the menu (buying no longer auto-closes)
  await expect(page.getByText(/BUY MENU/)).not.toBeVisible()
}
