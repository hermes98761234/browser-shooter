import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { createGrenadeModel } from '../weapons/GrenadeModel'
import { BombModel } from '../weapons/BombModel'
import { DefuseKitModel } from '../weapons/DefuseKitModel'
import { weaponVisual } from '../weapons/WeaponDefs'
import type { GrenadeType, StoreItem } from '../types'

interface BuyPreviewProps {
  item: StoreItem | null
}

const GRENADE_KEY: Record<string, GrenadeType> = {
  he_grenade: 'he',
  flashbang: 'flash',
  smoke_grenade: 'smoke',
}

const GUN_PROFILE = {
  pistol: { len: 0.35, color: 0x303030 },
  shotgun: { len: 0.6, color: 0x5a3a1a },
  rifle: { len: 0.85, color: 0x2a2a2a },
}

const std = (color: number, metalness = 0.5, roughness = 0.5) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness })

function buildGun(len: number, color: number): THREE.Group {
  const g = new THREE.Group()
  const mat = std(color, 0.6, 0.5)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.32), mat)
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, len), mat)
  barrel.position.set(0, 0.02, -0.16 - len / 2)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), mat)
  grip.position.set(0, -0.16, 0.09)
  grip.rotation.x = 0.2
  g.add(body, barrel, grip)
  g.rotation.y = Math.PI / 2
  return g
}

function buildVest(helmet: boolean): THREE.Group {
  const g = new THREE.Group()
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), std(0x2f6b2f))
  g.add(vest)
  if (helmet) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x394b39))
    head.position.y = 0.4
    g.add(head)
  }
  return g
}

function buildMedkit(): THREE.Group {
  const g = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), std(0xe8e8e8, 0.1, 0.8))
  g.add(box)
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xd03030 })
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.01), crossMat)
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.01), crossMat)
  v.position.z = 0.105
  h.position.z = 0.105
  g.add(v, h)
  return g
}

function buildBoots(): THREE.Group {
  const g = new THREE.Group()
  const mat = std(0x6b4a2f, 0.2, 0.8)
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.4), mat)
  foot.position.set(0, -0.1, 0.05)
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), mat)
  shaft.position.set(0, 0.05, -0.1)
  g.add(foot, shaft)
  return g
}

function buildUpgrade(): THREE.Group {
  const g = new THREE.Group()
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.1), std(0x4a4a55, 0.7, 0.4))
  mag.rotation.z = 0.15
  g.add(mag)
  return g
}

/** Builds a display model for a store item, normalized to a viewable size. */
function buildModel(item: StoreItem): THREE.Object3D {
  if (item.kind === 'grenade') {
    const type = GRENADE_KEY[item.id] ?? 'he'
    const g = createGrenadeModel(type)
    g.scale.setScalar(4)
    return g
  }
  if (item.kind === 'objective') return new BombModel().mesh
  if (item.kind === 'gear') {
    const kit = new DefuseKitModel().mesh
    kit.scale.setScalar(2.2)
    return kit
  }
  if (item.kind === 'weapon') {
    const profile = GUN_PROFILE[weaponVisual(item.weaponType ?? 'rifle')]
    return buildGun(profile.len, profile.color)
  }
  if (item.kind === 'armor') return buildVest(item.effects?.helmet === true)
  if (item.kind === 'health') return buildMedkit()
  if (item.kind === 'speed') return buildBoots()
  if (item.kind === 'upgrade') return buildUpgrade()
  return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), std(0x666666))
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material.dispose()
    }
  })
}

export function BuyPreview({ item }: BuyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 0.4, 1.6)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(200, 200)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

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
      if (modelRef.current) {
        disposeObject(modelRef.current)
        modelRef.current = null
      }
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return

    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current)
      disposeObject(modelRef.current)
      modelRef.current = null
    }

    if (!item) return

    const model = buildModel(item)
    sceneRef.current.add(model)
    modelRef.current = model
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
