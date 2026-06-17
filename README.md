# Browser Shooter

**3D first-person arena wave survival game — runs entirely in the browser**

[Live Demo](https://hermes98761234.github.io/browser-shooter/)

## Description

Browser Shooter is a fast-paced 3D FPS arena survival game built with Three.js and React. Fight off waves of increasingly difficult enemies, switch between weapons, collect pickups, and survive as long as you can. All rendering, physics, audio, and game logic run client-side in the browser with no server required.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Three.js](https://threejs.org/) | 3D rendering, scene graph, materials, shadows |
| [React](https://react.dev/) | UI layer — HUD, menus, overlays |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe game logic and tooling |
| [Vite](https://vitejs.dev/) | Build tool and dev server |
| [Vitest](https://vitest.dev/) | Unit testing (257 tests across 14 files) |
| [Playwright](https://playwright.dev/) | End-to-end browser testing (36 tests across 3 files) |

## Features

- **3D Arena** — Fully rendered 3D environment with dynamic lighting, shadows, and a skybox
- **Three Weapons** — Pistol (balanced), Shotgun (spread, high close-range damage), Rifle (accurate, high damage)
- **Enemy Variety** — Grunts (standard), Runners (fast, weak), Tanks (slow, high HP) with chase/attack AI
- **Wave System** — Progressive difficulty with increasing enemy counts and variety between waves
- **Particle Effects** — Muzzle flash, bullet impact sparks, blood splatter, death explosions
- **Sound Effects** — Web Audio API with spatial HRTF audio, pitch variation, and synthesized fallbacks for all actions (shooting, hits, deaths, pickups, wave starts)
- **HUD** — Health bar, ammo counter, weapon indicator, score, wave number, kill feed, minimap, damage overlay
- **Pickups** — Health and ammo pickups spawn between waves
- **Persistent High Score** — Saved to localStorage
- **Pause Menu** — Full pause overlay with controls reminder
- **Responsive UI** — React-based HUD components with wave announcements and game over screen

## Controls

| Key / Input | Action |
|-------------|--------|
| `W` `A` `S` `D` | Move |
| Mouse | Look around |
| Left Click | Shoot |
| `1` `2` `3` | Switch weapon (Pistol / Shotgun / Rifle) |
| `R` | Reload |
| `Space` | Jump |
| `M` | Toggle mute |
| `ESC` | Pause / Resume |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/hermes98761234/browser-shooter.git
cd browser-shooter
npm install
```

### Development

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
```

### Testing

```bash
npm test                # Run all 257 unit tests (Vitest)
npm run test:e2e        # Run all 36 E2E tests (Playwright, Chromium)
```

### Build

```bash
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
```

### Lint

```bash
npm run lint         # ESLint
```

## Project Structure

```
browser-shooter/
├── .github/workflows/        # CI/CD pipelines (ci.yml, deploy.yml, release.yml)
├── e2e/                      # Playwright E2E tests
│   ├── controls.spec.ts      # Input and controls tests
│   ├── game.spec.ts          # Core gameplay flow tests
│   └── ui.spec.ts            # HUD and overlay tests
├── public/                   # Static assets
├── src/
│   ├── audio/                # AudioManager, SoundEffects, MP3 samples
│   │   ├── sounds/           # Weapon, hit, death, pickup audio files
│   │   ├── AudioManager.ts   # Web Audio API: loading, caching, spatial audio
│   │   └── SoundEffects.ts   # Semantic sound playback helpers
│   ├── effects/              # Visual particle effects
│   │   ├── BulletImpact.ts   # Spark particles on hit
│   │   ├── DamageIndicator.ts # Directional damage feedback
│   │   ├── Explosion.ts      # Enemy death explosions
│   │   ├── MuzzleFlash.ts    # Muzzle flash on shoot
│   │   └── ParticleSystem.ts # Reusable particle pool
│   ├── enemies/              # Enemy AI and wave management
│   │   ├── Enemy.ts          # Enemy entity with chase/attack behavior
│   │   ├── EnemyDefs.ts      # Enemy type definitions (Grunt, Runner, Tank)
│   │   └── WaveManager.ts    # Wave spawning and difficulty scaling
│   ├── engine/               # Core Three.js engine
│   │   ├── Arena.ts          # Arena geometry, walls, floor, skybox
│   │   ├── Camera.ts         # First-person camera controller
│   │   ├── GameEngine.ts     # Main game loop, scene management, state
│   │   ├── Lighting.ts       # Ambient, directional, and point lights
│   │   └── Renderer.ts       # WebGL renderer setup with shadows
│   ├── player/               # Player logic
│   │   ├── Controls.ts       # Keyboard/mouse input handling
│   │   └── Player.ts         # Player state, movement, health
│   ├── systems/              # Gameplay systems
│   │   ├── AmmoSystem.ts     # Ammo tracking and reloading
│   │   ├── HealthSystem.ts   # Health, damage, death handling
│   │   ├── Pickup.ts         # Health/ammo pickup spawning and collection
│   │   └── ScoreSystem.ts    # Scoring and high score persistence
│   ├── ui/                   # React UI components
│   │   ├── DamageOverlay.tsx # Red vignette on damage
│   │   ├── GameOver.tsx      # Game over screen with score
│   │   ├── HUD.tsx           # In-game HUD (health, ammo, score, wave)
│   │   ├── MainMenu.tsx      # Start screen
│   │   ├── Minimap.tsx       # Top-down minimap
│   │   ├── PauseMenu.tsx     # Pause overlay with controls
│   │   └── WaveAnnounce.tsx  # Wave number announcement overlay
│   ├── weapons/              # Weapon system
│   │   ├── Weapon.ts         # Individual weapon logic (fire, reload, spread)
│   │   ├── WeaponDefs.ts     # Weapon type definitions and stats
│   │   └── WeaponManager.ts  # Weapon switching and ammo management
│   ├── App.tsx               # Root React component, game state orchestration
│   ├── main.tsx              # Entry point — mounts React app
│   ├── types.ts              # Shared TypeScript type definitions
│   └── index.css             # Global styles
├── index.html                # HTML entry point
├── vite.config.ts            # Vite + Vitest configuration
├── tsconfig.json             # TypeScript config (project references)
├── tsconfig.app.json         # App-specific TS config
├── tsconfig.node.json        # Node/tooling TS config
├── eslint.config.js          # ESLint flat config
├── playwright.config.ts      # Playwright configuration
└── package.json              # Dependencies and scripts
```

## Deployment

Pushing to `main` triggers GitHub Actions:

1. **CI** — Lint, unit tests (257), E2E tests (36), and production build
2. **Deploy** — Automatic deployment to [GitHub Pages](https://hermes98761234.github.io/browser-shooter/)

Tag with `v*` (e.g. `v1.0.0`) to trigger a release build with a distributable zip attached to the GitHub Release.

## Known Follow-ups (TODO)

PvP is functional and host-authoritative. Two client-side polish gaps remain (host side is correct):

- [ ] **Client lobby rosters are empty.** The host shows who is on CT vs T, but it never broadcasts roster/team changes to clients, so a joined client's CT/T roster panels render empty. Fix: have the host push the roster (names + teams) to clients on join and on `setTeam` (a small lobby-sync message or snapshot piggyback).
- [ ] **Client kill feed shows raw player IDs instead of names.** Remote players aren't in the client's local player map, so the client kill feed prints e.g. `player-2`. Fix: carry the attacker/victim names in the `playerKilledPlayer` event (or resolve them from the snapshot's `players`).

## License

MIT
