import type { CrosshairConfig } from '../settings/Crosshair'
import { BLOOM_PIXELS } from '../weapons/CrosshairBloom'

/**
 * Draw a crosshair onto a 2D canvas context, centered at (cx, cy).
 *
 * `bloom` is the normalized inaccuracy from the bloom model; it only affects the
 * gap when the config style is 'dynamic'. The same function powers the in-game
 * HUD crosshair and the live preview in settings, so they always match.
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  cfg: CrosshairConfig,
  bloom: number,
  cx: number,
  cy: number,
): void {
  const dynamicGap = cfg.style === 'dynamic' ? bloom * BLOOM_PIXELS : 0
  const gap = cfg.gap + dynamicGap
  const t = cfg.thickness
  const half = t / 2
  const len = cfg.size

  ctx.save()
  ctx.globalAlpha = cfg.opacity

  // Each arm: [whether to draw, direction]. The top arm is dropped in T-style.
  const arms: Array<[boolean, number, number]> = [
    [!cfg.tStyle, 0, -1], // up
    [true, 0, 1],         // down
    [true, -1, 0],        // left
    [true, 1, 0],         // right
  ]

  // Outline pass: a dark rectangle slightly larger than each line, drawn first.
  if (cfg.outline && cfg.outlineThickness > 0) {
    const o = cfg.outlineThickness
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    for (const [draw, dx, dy] of arms) {
      if (!draw) continue
      armRect(ctx, cx, cy, dx, dy, gap, len, half, o)
    }
    if (cfg.dot) {
      ctx.fillRect(cx - half - o, cy - half - o, t + o * 2, t + o * 2)
    }
  }

  // Line pass.
  ctx.fillStyle = cfg.color
  for (const [draw, dx, dy] of arms) {
    if (!draw) continue
    armRect(ctx, cx, cy, dx, dy, gap, len, half, 0)
  }
  if (cfg.dot) {
    ctx.fillRect(cx - half, cy - half, t, t)
  }

  ctx.restore()
}

/**
 * Fill one crosshair arm as a rectangle, optionally inflated by `pad` on every
 * side (used for the outline pass).
 */
function armRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  gap: number,
  len: number,
  half: number,
  pad: number,
): void {
  if (dx !== 0) {
    // Horizontal arm.
    const x = dx > 0 ? cx + gap : cx - gap - len
    ctx.fillRect(x - pad, cy - half - pad, len + pad * 2, half * 2 + pad * 2)
  } else {
    // Vertical arm.
    const y = dy > 0 ? cy + gap : cy - gap - len
    ctx.fillRect(cx - half - pad, y - pad, half * 2 + pad * 2, len + pad * 2)
  }
}
