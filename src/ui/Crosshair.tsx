import React, { useEffect, useRef } from 'react'
import type { CrosshairConfig } from '../settings/Crosshair'
import { drawCrosshair } from './drawCrosshair'

/** Live crosshair state the game loop updates every frame. */
export interface CrosshairRuntime {
  config: CrosshairConfig
  bloom: number
}

const CANVAS = 220 // device-independent px; comfortably fits max gap + bloom + line length

interface CrosshairProps {
  runtime: React.MutableRefObject<CrosshairRuntime>
}

/**
 * Center-screen crosshair. Drives itself from `runtime` via requestAnimationFrame
 * so dynamic bloom animates smoothly without re-rendering React on every frame.
 */
export const Crosshair: React.FC<CrosshairProps> = ({ runtime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS * dpr
    canvas.height = CANVAS * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const render = () => {
      ctx.clearRect(0, 0, CANVAS, CANVAS)
      const { config, bloom } = runtime.current
      drawCrosshair(ctx, config, bloom, CANVAS / 2, CANVAS / 2)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [runtime])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS}
      height={CANVAS}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: CANVAS,
        height: CANVAS,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  )
}
