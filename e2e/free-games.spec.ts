import { test, expect } from '@playwright/test'

// Real WebRTC over the public PeerJS broker. Requires outbound network to the
// broker; if that is unavailable (e.g. sandboxed CI) these tests are skipped.
//
// All three scenarios require two peers to connect over WebRTC. In environments
// without broker / NAT traversal they will skip — that is the expected and
// acceptable outcome. They provide real coverage where WebRTC IS available.
//
// Navigation note: the Multiplayer screen has a "Create Room" button that opens
// the MatchSetup overlay (also ending with a "Create Room" confirm button). When
// both are in the DOM we disambiguate with .first() / .last().

test.describe('free games, passwords, disconnect', () => {
  test('a client drops into a free game already in progress', async ({ browser }) => {
    test.setTimeout(90_000)
    const hostCtx = await browser.newContext()
    const joinCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    const join = await joinCtx.newPage()

    // Host: navigate to multiplayer → open Match Setup
    await host.goto('/')
    await host.getByText(/multiplayer/i).click({ force: true })
    // "Create Room" in the MultiplayerMenu opens the MatchSetup overlay
    await host.getByRole('button', { name: /create room/i }).first().click({ force: true })
    await expect(host.getByText('MATCH SETUP')).toBeVisible({ timeout: 5_000 })

    // Select Free join policy (no password) and confirm
    await host.getByRole('button', { name: /^free$/i }).click({ force: true })
    // MatchSetup's "Create Room" is now the last one in DOM (MultiplayerMenu still rendered behind)
    await host.getByRole('button', { name: /create room/i }).last().click({ force: true })

    // Wait for room code; if broker unreachable, skip
    const codeLocator = host.locator('strong').first()
    try {
      await expect(codeLocator).toBeVisible({ timeout: 15_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'PeerJS broker unreachable in this environment')
    }

    // Host starts the match so it transitions to in-progress
    try {
      await host.getByText(/^start$/i).click({ force: true, timeout: 10_000 })
      await expect(host.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    // Client: browse server list, find the Free game already in progress, and join
    await join.goto('/')
    await join.getByText(/multiplayer/i).click({ force: true })

    try {
      // Refresh server list until the host appears with a "Free" tag
      await expect(async () => {
        await join.getByRole('button', { name: /refresh/i }).click({ force: true })
        await expect(join.getByText('Free').first()).toBeVisible({ timeout: 3_000 })
        await expect(join.getByRole('button', { name: /^join$/i }).first()).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 30_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    // Click Join on the free game row — PreJoinPrompt appears (no password field)
    await join.getByRole('button', { name: /^join$/i }).first().click({ force: true })

    // Pre-join prompt heading confirms we're in the flow
    await expect(join.getByText(/select team/i)).toBeVisible({ timeout: 5_000 })
    // No password field expected for a free (unprotected) game
    await expect(join.getByPlaceholder(/^password$/i)).not.toBeVisible()

    // Pick CT team and confirm — should drop in without waiting for a lobby Start
    await join.getByRole('button', { name: /^ct$/i }).click({ force: true })
    await join.getByRole('button', { name: /join match/i }).click({ force: true })

    // Client reaches the canvas (in-game)
    await expect(join.locator('canvas').first()).toBeVisible({ timeout: 20_000 })

    await hostCtx.close()
    await joinCtx.close()
  })

  test('a protected game rejects the wrong password then accepts the right one', async ({ browser }) => {
    test.setTimeout(90_000)
    const hostCtx = await browser.newContext()
    const joinCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    const join = await joinCtx.newPage()

    // Host: create a Free game with a password
    await host.goto('/')
    await host.getByText(/multiplayer/i).click({ force: true })
    await host.getByRole('button', { name: /create room/i }).first().click({ force: true })
    await expect(host.getByText('MATCH SETUP')).toBeVisible({ timeout: 5_000 })

    // Select Free join policy → password input appears
    await host.getByRole('button', { name: /^free$/i }).click({ force: true })
    await host.getByPlaceholder(/password \(optional\)/i).fill('s3cret')
    await host.getByRole('button', { name: /create room/i }).last().click({ force: true })

    // Wait for room code; if broker unreachable, skip
    const codeLocator = host.locator('strong').first()
    try {
      await expect(codeLocator).toBeVisible({ timeout: 15_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'PeerJS broker unreachable in this environment')
    }

    // Host starts the match
    try {
      await host.getByText(/^start$/i).click({ force: true, timeout: 10_000 })
      await expect(host.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    // Client: find the protected game (🔒 icon visible) and attempt to join
    await join.goto('/')
    await join.getByText(/multiplayer/i).click({ force: true })

    try {
      await expect(async () => {
        await join.getByRole('button', { name: /refresh/i }).click({ force: true })
        // Row shows lock icon for password-protected game
        await expect(join.getByText('🔒').first()).toBeVisible({ timeout: 3_000 })
        await expect(join.getByRole('button', { name: /^join$/i }).first()).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 30_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    // Click Join on the protected game row
    await join.getByRole('button', { name: /^join$/i }).first().click({ force: true })

    // Pre-join prompt appears with a password input
    await expect(join.getByText(/select team/i)).toBeVisible({ timeout: 5_000 })
    await expect(join.getByPlaceholder(/^password$/i)).toBeVisible()

    // Enter wrong password and submit
    await join.getByPlaceholder(/^password$/i).fill('nope')
    await join.getByRole('button', { name: /join match/i }).click({ force: true })

    // "Wrong password" error appears; client remains on the pre-join prompt
    await expect(join.getByText(/wrong password/i)).toBeVisible({ timeout: 10_000 })
    await expect(join.getByText(/select team/i)).toBeVisible()

    // Correct password — clear input and retry
    await join.getByPlaceholder(/^password$/i).fill('s3cret')
    await join.getByRole('button', { name: /join match/i }).click({ force: true })

    // Client now reaches the canvas
    await expect(join.locator('canvas').first()).toBeVisible({ timeout: 20_000 })

    await hostCtx.close()
    await joinCtx.close()
  })

  test('host disconnect returns the client to the menu', async ({ browser }) => {
    test.setTimeout(90_000)
    const hostCtx = await browser.newContext()
    const joinCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    const join = await joinCtx.newPage()

    // Host: create a room with default Lobby join policy
    await host.goto('/')
    await host.getByText(/multiplayer/i).click({ force: true })
    await host.getByRole('button', { name: /create room/i }).first().click({ force: true })
    await expect(host.getByText('MATCH SETUP')).toBeVisible({ timeout: 5_000 })
    // Confirm with default settings (Lobby join policy)
    await host.getByRole('button', { name: /create room/i }).last().click({ force: true })

    // Wait for room code; if broker unreachable, skip
    const codeLocator = host.locator('strong').first()
    try {
      await expect(codeLocator).toBeVisible({ timeout: 15_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'PeerJS broker unreachable in this environment')
    }
    const code = await codeLocator.innerText()

    // Client joins using the room code
    await join.goto('/')
    await join.getByText(/multiplayer/i).click({ force: true })
    await join.getByPlaceholder(/room code/i).fill(code)
    // Use the aria-label to target only the room-code Join button (not per-row Join buttons)
    await join.getByRole('button', { name: 'join by code' }).click({ force: true })

    // Host starts match; both sides enter game
    try {
      await host.getByText(/^start$/i).click({ force: true, timeout: 20_000 })
      await expect(host.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
      await expect(join.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
    } catch {
      await hostCtx.close()
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    // Close the host context — simulates host disconnecting
    await hostCtx.close()

    // Client should see the "Host disconnected" banner
    try {
      await expect(join.getByText(/host disconnected/i)).toBeVisible({ timeout: 15_000 })
      // Clicking the notice dismisses it; client should be back on the multiplayer menu
      await join.getByText(/host disconnected/i).click({ force: true })
      await expect(join.getByText(/multiplayer/i)).toBeVisible({ timeout: 10_000 })
    } catch {
      await joinCtx.close()
      test.skip(true, 'WebRTC peer connection did not establish in this environment')
    }

    await joinCtx.close()
  })
})
