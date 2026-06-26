import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface MinimapProps {
  playerPosition: THREE.Vector3
  playerRotation: number
  enemies: THREE.Vector3[]
  allies?: { x: number; z: number }[]
  arenaSize: number
  bombsites?: { id: string; position: { x: number; z: number } }[]
  bombPosition?: { x: number; z: number }
  structures?: { center: [number, number, number]; size: [number, number, number] }[]
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPosition,
  playerRotation,
  enemies,
  allies,
  arenaSize,
  bombsites,
  bombPosition,
  structures,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 767px)').matches)
  const propsRef = useRef({ playerPosition, playerRotation, enemies, allies, arenaSize, bombsites, bombPosition, structures })
  propsRef.current = { playerPosition, playerRotation, enemies, allies, arenaSize, bombsites, bombPosition, structures }

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf: number

    const draw = () => {
      const { playerPosition, playerRotation, enemies, allies, arenaSize, bombsites, bombPosition, structures } = propsRef.current
      const size = isMobile ? 80 : 150
      const scale = size / (arenaSize * 2.5)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, 0, size, size)

      const cx = size / 2
      const cy = size / 2

      if (structures) {
        ctx.fillStyle = '#3a3a3a'
        for (const s of structures) {
          const sx = cx + (s.center[0] - playerPosition.x) * scale
          const sy = cy + (s.center[2] - playerPosition.z) * scale
          // ponytail: clamp to 2px so 0.5-unit walls aren't sub-pixel invisible
          const sw = Math.max(s.size[0] * scale, 2)
          const sd = Math.max(s.size[2] * scale, 2)
          ctx.fillRect(sx - sw / 2, sy - sd / 2, sw, sd)
        }
      }

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-playerRotation)
      ctx.fillStyle = '#00ff00'
      ctx.beginPath()
      ctx.moveTo(0, -5)
      ctx.lineTo(-3, 3)
      ctx.lineTo(3, 3)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      for (const enemy of enemies) {
        const ex = cx + (enemy.x - playerPosition.x) * scale
        const ey = cy + (enemy.z - playerPosition.z) * scale
        if (ex > 5 && ex < size - 5 && ey > 5 && ey < size - 5) {
          ctx.fillStyle = '#ff0000'
          ctx.beginPath()
          ctx.arc(ex, ey, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Teammates (cyan) so you can see where your team / bots are.
      if (allies) {
        for (const ally of allies) {
          const ax = cx + (ally.x - playerPosition.x) * scale
          const ay = cy + (ally.z - playerPosition.z) * scale
          if (ax > 5 && ax < size - 5 && ay > 5 && ay < size - 5) {
            ctx.fillStyle = '#33ddff'
            ctx.beginPath()
            ctx.arc(ax, ay, 2.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      if (bombsites) {
        for (const site of bombsites) {
          const sx = cx + (site.position.x - playerPosition.x) * scale
          const sy = cy + (site.position.z - playerPosition.z) * scale
          if (sx > 5 && sx < size - 5 && sy > 5 && sy < size - 5) {
            ctx.fillStyle = site.id === 'A' ? '#ff3333' : '#3333ff'
            ctx.font = 'bold 12px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(site.id, sx, sy)
          }
        }
      }

      if (bombPosition) {
        const bx = cx + (bombPosition.x - playerPosition.x) * scale
        const by = cy + (bombPosition.z - playerPosition.z) * scale
        if (bx > 5 && bx < size - 5 && by > 5 && by < size - 5) {
          ctx.fillStyle = '#ff0000'
          ctx.beginPath()
          ctx.arc(bx, by, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [isMobile, arenaSize])

  return (
    <canvas
      ref={canvasRef}
      width={isMobile ? 80 : 150}
      height={isMobile ? 80 : 150}
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        borderRadius: 8,
        border: '1px solid #555',
      }}
    />
  )
}
