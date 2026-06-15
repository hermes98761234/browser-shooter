# Browser Shooter

**3D FPS arena wave survival game in the browser** · [Live Demo](https://hermes98761234.github.io/browser-shooter/)

## Features

- **3D First-Person Shooter** — Full 3D arena with Three.js rendering, shadows, and lighting
- **Multiple Weapons** — Pistol, Shotgun, and Rifle with unique stats and spread
- **Enemy AI** — Grunts, Runners, and Tanks with chase/attack behaviors
- **Wave System** — Increasingly difficult waves with enemy variety
- **Particle Effects** — Muzzle flash, bullet impacts, blood splatter, explosions
- **Sound Effects** — Procedural audio for shooting, hits, pickups, and wave starts
- **HUD** — Health bar, ammo counter, score, wave info, minimap
- **Pickups** — Health and ammo pickups spawn between waves
- **Persistent High Score** — Saved in localStorage

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look |
| Left Click | Shoot |
| 1-3 | Switch Weapon |
| R | Reload |
| Space | Jump |
| M | Mute Sound |
| ESC | Pause |

## Development

```bash
npm install
npm run dev      # start dev server
npm test         # run unit tests
npm run test:e2e # run E2E tests
npm run build    # production build
npm run preview  # preview production build
```

### Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/engine/` | Three.js scene, renderer, arena |
| `src/player/` | Player controls and movement |
| `src/weapons/` | Weapon definitions and manager |
| `src/enemies/` | Enemy types, AI, and wave system |
| `src/systems/` | Health, score, and pickup systems |
| `src/effects/` | Particle effects |
| `src/audio/` | Sound effects |
| `src/ui/` | React UI components (HUD, menus) |

## Tech Stack

[Three.js](https://threejs.org/) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vitejs.dev/) · [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/)

## Deployment

Push to `main` → GitHub Actions automatically builds and deploys to [GitHub Pages](https://hermes98761234.github.io/browser-shooter/).
