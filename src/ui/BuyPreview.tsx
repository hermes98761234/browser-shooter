import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { StoreItem } from '../types'

interface BuyPreviewProps {
  item: StoreItem | null
}

export function BuyPreview({ item }: BuyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const modelRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 0.5, 2)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(200, 200)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Animation loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.01
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return

    // Remove old model
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current)
      modelRef.current = null
    }

    if (!item) return

    // Create placeholder model based on item kind
    const group = new THREE.Group()

    if (item.kind === 'weapon') {
      // Gun shape placeholder
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      )
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      )
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.05, -0.2)
      group.add(body, barrel)
    } else if (item.kind === 'armor') {
      // Vest shape placeholder
      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      group.add(vest)
    } else if (item.kind === 'objective') {
      // Bomb shape
      const bomb = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      )
      group.add(bomb)
    } else {
      // Generic box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x666666 })
      )
      group.add(box)
    }

    sceneRef.current.add(group)
    modelRef.current = group
  }, [item])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div ref={containerRef} style={{ width: 200, height: 200, border: '1px solid #3a3a55' }} />
      {item ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 'bold' }}>{item.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {item.price === 0 ? 'FREE' : `$${item.price}`}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.5 }}>Select an item</div>
      )}
    </div>
  )
}