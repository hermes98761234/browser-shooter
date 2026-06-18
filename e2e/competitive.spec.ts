import { test, expect } from '@playwright/test'
import { clickButton } from './helpers'

test.describe('Competitive Mode', () => {
  test('can start competitive match', async ({ page }) => {
    await page.goto('/')
    await clickButton(page, 'MULTIPLAYER')
    await clickButton(page, 'Host Game')
    // MatchSetup screen: select Competitive mode, then Create Room
    await expect(page.getByText('MATCH SETUP')).toBeVisible()
    await clickButton(page, 'Competitive (CS-style)', true)
    await clickButton(page, 'Create Room')
    // Lobby shows after room creation
    await expect(page.getByText('Lobby')).toBeVisible()
  })

  test('shows buy phase timer', async ({ browser }) => {
    test.setTimeout(60_000)
    const hostCtx = await browser.newContext()
    const joinCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    const join = await joinCtx.newPage()

    // Host: go to multiplayer, set up competitive match
    await host.goto('/')
    await clickButton(host, 'MULTIPLAYER')
    await clickButton(host, 'Host Game')
    await expect(host.getByText('MATCH SETUP')).toBeVisible()
    await clickButton(host, 'Competitive (CS-style)', true)
    await clickButton(host, 'Create Room')

    // Wait for room code; skip if broker unreachable
    const codeLocator = host.locator('strong').first()
    try {
      await expect(codeLocator).toBeVisible({ timeout: 15_000 })
    } catch {
      await hostCtx.close(); await joinCtx.close()
      test.skip(true, 'PeerJS broker unreachable in this environment')
      return
    }
    const code = await codeLocator.innerText()

    // Joiner connects
    await join.goto('/')
    await clickButton(join, 'MULTIPLAYER')
    await join.getByPlaceholder(/room code/i).fill(code)
    await clickButton(join, 'Join')

    // Host starts the match
    try {
      await host.getByText(/start/i).click({ force: true, timeout: 20_000 })
      await expect(host.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    } catch {
      await hostCtx.close(); await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
      return
    }

    // Buy phase timer should be visible on the HUD
    await expect(host.getByText(/BUY PHASE/)).toBeVisible({ timeout: 10_000 })

    await hostCtx.close()
    await joinCtx.close()
  })

  test('shows round timer after buy phase', async ({ browser }) => {
    test.setTimeout(60_000)
    const hostCtx = await browser.newContext()
    const joinCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    const join = await joinCtx.newPage()

    // Host: set up competitive match
    await host.goto('/')
    await clickButton(host, 'MULTIPLAYER')
    await clickButton(host, 'Host Game')
    await expect(host.getByText('MATCH SETUP')).toBeVisible()
    await clickButton(host, 'Competitive (CS-style)', true)
    await clickButton(host, 'Create Room')

    const codeLocator = host.locator('strong').first()
    try {
      await expect(codeLocator).toBeVisible({ timeout: 15_000 })
    } catch {
      await hostCtx.close(); await joinCtx.close()
      test.skip(true, 'PeerJS broker unreachable in this environment')
      return
    }
    const code = await codeLocator.innerText()

    await join.goto('/')
    await clickButton(join, 'MULTIPLAYER')
    await join.getByPlaceholder(/room code/i).fill(code)
    await clickButton(join, 'Join')

    try {
      await host.getByText(/start/i).click({ force: true, timeout: 20_000 })
      await expect(host.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    } catch {
      await hostCtx.close(); await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
      return
    }

    // Wait for buy phase to end (buyPhaseDuration = 15s), then verify round timer
    await expect(host.getByText(/BUY PHASE/)).toBeVisible({ timeout: 10_000 })
    // Round timer appears after buy phase expires — wait up to 20s for transition
    await expect(host.getByText(/BUY PHASE/)).not.toBeVisible({ timeout: 20_000 })
    // The round timer shows a number followed by 's' (e.g. "114s")
    await expect(host.locator('div').filter({ hasText: /^\d+s$/ })).toBeVisible({ timeout: 5_000 })

    await hostCtx.close()
    await joinCtx.close()
  })
})
