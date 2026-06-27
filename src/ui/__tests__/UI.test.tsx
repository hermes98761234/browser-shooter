import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HUD } from '../HUD'
import { Crosshair } from '../Crosshair'
import { DEFAULT_CROSSHAIR } from '../../settings/Crosshair'
import { Minimap } from '../Minimap'
import { WaveAnnounce } from '../WaveAnnounce'
import { MainMenu } from '../MainMenu'
import { GameOver } from '../GameOver'
import { PauseMenu } from '../PauseMenu'
import * as THREE from 'three'

afterEach(cleanup)

describe('HUD', () => {
  it('renders health bar with correct values', () => {
    render(
      <HUD
        health={75}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={1500}
        wave={3}
        waveActive={true}
        enemiesRemaining={5}
      />
    )
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('75 / 100')).toBeInTheDocument()
  })

  it('renders ammo counter', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={25}
        maxAmmo={60}
        weaponName="Rifle"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
      />
    )
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('/ 60')).toBeInTheDocument()
    expect(screen.getByText('Rifle')).toBeInTheDocument()
  })

  it('renders score display', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={60}
        maxAmmo={60}
        weaponName="Pistol"
        score={12500}
        wave={2}
        waveActive={true}
        enemiesRemaining={8}
      />
    )
    expect(screen.getByText('SCORE')).toBeInTheDocument()
    expect(screen.getByText('12,500')).toBeInTheDocument()
  })

  it('renders wave number', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={60}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={5}
        waveActive={true}
        enemiesRemaining={10}
      />
    )
    expect(screen.getByText('WAVE')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders enemies remaining when wave is active', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={60}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={2}
        waveActive={true}
        enemiesRemaining={7}
      />
    )
    expect(screen.getByText('7 enemies remaining')).toBeInTheDocument()
  })

  it('renders the crosshair canvas', () => {
    const runtime = { current: { config: DEFAULT_CROSSHAIR, bloom: 0 } }
    const { container } = render(<Crosshair runtime={runtime} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('shows low health color', () => {
    const { container } = render(
      <HUD
        health={20}
        maxHealth={100}
        ammo={60}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
      />
    )
    const healthBar = container.querySelector('[style*="width: 20%"]')
    expect(healthBar).toBeInTheDocument()
  })
})

describe('Minimap', () => {
  it('renders a canvas element', () => {
    const { container } = render(
      <Minimap
        playerPosition={new THREE.Vector3(0, 0, 0)}
        playerRotation={0}
        enemies={[]}
        arenaSize={30}
      />
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas?.getAttribute('width')).toBe('150')
    expect(canvas?.getAttribute('height')).toBe('150')
  })

  it('renders with enemy positions', () => {
    const { container } = render(
      <Minimap
        playerPosition={new THREE.Vector3(0, 0, 0)}
        playerRotation={0}
        enemies={[new THREE.Vector3(5, 0, 5), new THREE.Vector3(-3, 0, 8)]}
        arenaSize={30}
      />
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })
})

describe('WaveAnnounce', () => {
  it('renders wave announcement when visible', () => {
    render(<WaveAnnounce wave={3} visible={true} />)
    expect(screen.getByText('WAVE')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows "GET READY!" for wave 2', () => {
    render(<WaveAnnounce wave={2} visible={true} />)
    expect(screen.getByText('GET READY!')).toBeInTheDocument()
  })

  it('shows "INCOMING!" for wave 3', () => {
    render(<WaveAnnounce wave={3} visible={true} />)
    expect(screen.getByText('INCOMING!')).toBeInTheDocument()
  })

  it('shows "DANGER!" for wave 5+', () => {
    render(<WaveAnnounce wave={5} visible={true} />)
    expect(screen.getByText('DANGER!')).toBeInTheDocument()
  })

  it('renders nothing when not visible', () => {
    const { container } = render(<WaveAnnounce wave={3} visible={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for wave 0', () => {
    const { container } = render(<WaveAnnounce wave={0} visible={true} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('MainMenu', () => {
  it('renders game title', () => {
    render(<MainMenu onSingleplayer={() => {}} onMultiplayer={() => {}} onPlanetary={() => {}} onSettings={() => {}} onAbout={() => {}} onHelp={() => {}} />)
    expect(screen.getByText('BROWSER SHOOTER')).toBeInTheDocument()
  })

  it('renders singleplayer and multiplayer buttons', () => {
    render(<MainMenu onSingleplayer={() => {}} onMultiplayer={() => {}} onPlanetary={() => {}} onSettings={() => {}} onAbout={() => {}} onHelp={() => {}} />)
    expect(screen.getByText('SINGLEPLAYER')).toBeInTheDocument()
    expect(screen.getByText('MULTIPLAYER')).toBeInTheDocument()
  })

  it('renders about and help buttons', () => {
    render(<MainMenu onSingleplayer={() => {}} onMultiplayer={() => {}} onPlanetary={() => {}} onSettings={() => {}} onAbout={() => {}} onHelp={() => {}} />)
    expect(screen.getByText('ABOUT')).toBeInTheDocument()
    expect(screen.getByText('HELP')).toBeInTheDocument()
  })

  it('calls onSingleplayer when singleplayer button is clicked', () => {
    const onSingleplayer = vi.fn()
    render(<MainMenu onSingleplayer={onSingleplayer} onMultiplayer={() => {}} onPlanetary={() => {}} onSettings={() => {}} onAbout={() => {}} onHelp={() => {}} />)
    screen.getByText('SINGLEPLAYER').click()
    expect(onSingleplayer).toHaveBeenCalledTimes(1)
  })
})

describe('MainMenu mode select', () => {
  it('fires onSingleplayer and onMultiplayer', () => {
    const sp = vi.fn(); const mp = vi.fn()
    render(<MainMenu onSingleplayer={sp} onMultiplayer={mp} onPlanetary={() => {}} onSettings={() => {}} onAbout={() => {}} onHelp={() => {}} />)
    fireEvent.click(screen.getByText(/singleplayer/i))
    fireEvent.click(screen.getByText(/multiplayer/i))
    expect(sp).toHaveBeenCalledTimes(1)
    expect(mp).toHaveBeenCalledTimes(1)
  })
})

describe('GameOver', () => {
  it('renders game over title', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('GAME OVER')).toBeInTheDocument()
  })

  it('renders final score', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('5,000')).toBeInTheDocument()
  })

  it('renders wave reached', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders high score', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('3,000')).toBeInTheDocument()
  })

  it('shows new high score when beaten', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('NEW HIGH SCORE!')).toBeInTheDocument()
  })

  it('does not show new high score when not beaten', () => {
    render(
      <GameOver
        score={2000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.queryByText('NEW HIGH SCORE!')).not.toBeInTheDocument()
  })

  it('renders restart and menu buttons', () => {
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(screen.getByText('PLAY AGAIN')).toBeInTheDocument()
    expect(screen.getByText('MAIN MENU')).toBeInTheDocument()
  })

  it('calls onRestart when play again is clicked', () => {
    const onRestart = vi.fn()
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={onRestart}
        onMenu={() => {}}
      />
    )
    screen.getByText('PLAY AGAIN').click()
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('calls onMenu when main menu is clicked', () => {
    const onMenu = vi.fn()
    render(
      <GameOver
        score={5000}
        wave={4}
        highScore={3000}
        onRestart={() => {}}
        onMenu={onMenu}
      />
    )
    screen.getByText('MAIN MENU').click()
    expect(onMenu).toHaveBeenCalledTimes(1)
  })
})

describe('competitive HUD', () => {
  it('shows round timer when provided', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        round={5}
        roundTimer={90}
        buyPhase={false}
        money={4200}
        ctScore={3}
        tScore={2}
      />
    )
    expect(screen.getByText('Round 5 | CT: 3 - T: 2')).toBeInTheDocument()
    expect(screen.getByText('90s')).toBeInTheDocument()
  })

  it('shows buy phase timer when in buy phase', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        round={1}
        roundTimer={115}
        buyPhase={true}
        buyPhaseTimer={12}
        money={800}
        ctScore={0}
        tScore={0}
      />
    )
    expect(screen.getByText('BUY PHASE: 12s')).toBeInTheDocument()
  })

  it('shows money when provided', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        money={4200}
      />
    )
    expect(screen.getByText('$4200')).toBeInTheDocument()
  })

  it('does not show round info when round is undefined', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
      />
    )
    expect(screen.queryByText(/Round/)).not.toBeInTheDocument()
  })
})

describe('bomb indicators', () => {
  it('shows bomb timer when planted', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        bombState="planted"
        bombTimer={35}
        bombSite="A"
      />
    )
    expect(screen.getByText('BOMB PLANTED AT A')).toBeInTheDocument()
    expect(screen.getByText('35s')).toBeInTheDocument()
  })

  it('shows plant progress when planting', () => {
    const { container } = render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        bombState="planting"
        bombSite="B"
        plantProgress={0.5}
      />
    )
    const progressBar = container.querySelector('[style*="width: 50%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows defuse progress when defusing', () => {
    const { container } = render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        bombState="defusing"
        defuseProgress={0.75}
      />
    )
    const progressBar = container.querySelector('[style*="width: 75%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('does not show bomb indicators when bombState is none', () => {
    render(
      <HUD
        health={100}
        maxHealth={100}
        ammo={30}
        maxAmmo={60}
        weaponName="Pistol"
        score={0}
        wave={1}
        waveActive={true}
        enemiesRemaining={3}
        bombState="none"
      />
    )
    expect(screen.queryByText(/BOMB/)).not.toBeInTheDocument()
  })
})

describe('PauseMenu', () => {
  const noop = () => {}
  const defaultProps = { onResume: noop, onSettings: noop, onMainMenu: noop, onHelp: noop }

  it('renders paused title', () => {
    render(<PauseMenu {...defaultProps} />)
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
  })

  it('renders resume button', () => {
    render(<PauseMenu {...defaultProps} />)
    expect(screen.getByText('RESUME')).toBeInTheDocument()
  })

  it('renders main menu button', () => {
    render(<PauseMenu {...defaultProps} />)
    expect(screen.getByText('MAIN MENU')).toBeInTheDocument()
  })

  it('calls onResume when resume is clicked', () => {
    const onResume = vi.fn()
    render(<PauseMenu {...defaultProps} onResume={onResume} />)
    screen.getByText('RESUME').click()
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('calls onMainMenu when main menu is clicked', () => {
    const onMainMenu = vi.fn()
    render(<PauseMenu {...defaultProps} onMainMenu={onMainMenu} />)
    screen.getByText('MAIN MENU').click()
    expect(onMainMenu).toHaveBeenCalledTimes(1)
  })

  it('renders help button', () => {
    render(<PauseMenu {...defaultProps} />)
    expect(screen.getByText('HELP')).toBeInTheDocument()
  })
})
