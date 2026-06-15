import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface MinimapProps {
  playerPosition: THREE.Vector3
  playerRotation: number
  enemies: THREE.Vector3[]
  arenaSize: number
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPosition,
  playerRotation,
  enemies,
  arenaSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 150
    const scale = size / (arenaSize * 2.5)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = '#444'
    ctx.strokeRect(10, 10, size - 20, size - 20)

    const cx = size / 2
    const cy = size / 2

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
  }, [playerPosition, playerRotation, enemies, arenaSize])

  return (
    <canvas
      ref={canvasRef}
      width={150}
      height={150}
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
