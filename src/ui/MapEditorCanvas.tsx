import React, { useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ZoneDef, ZoneStructure, StructureMaterial } from '../zones/ZoneDef'

export type Tool = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood' | 'tspawn' | 'ctspawn' | 'bombA' | 'bombB' | 'eraser'
export type TopSnapRef = { snap: () => void }

const MATERIAL_COLOR: Record<StructureMaterial, string> = {
  wall: '#8b8b8b', crate: '#8b6914', concrete: '#bbbbbb', metal: '#6688aa', wood: '#aa7744',
}
const DEFAULT_HEIGHT: Record<StructureMaterial, number> = {
  wall: 3, crate: 1.5, concrete: 2, metal: 2, wood: 1.5,
}
const STRUCTURE_MATERIALS: StructureMaterial[] = ['wall', 'crate', 'concrete', 'metal', 'wood']

function snapToGrid(v: number) { return Math.round(v * 2) / 2 }

function SceneContent({
  zone, tool, selectedIdx, onPlaceStructure, onPlaceSpawn, onMoveBombsite,
  onSelectStructure, onDeleteStructure, onDeleteSpawn, topSnapRef,
}: {
  zone: ZoneDef; tool: Tool; selectedIdx: number | null
  onPlaceStructure: (s: ZoneStructure) => void
  onPlaceSpawn: (type: 'T' | 'CT', x: number, z: number) => void
  onMoveBombsite: (id: 'A' | 'B', x: number, z: number) => void
  onSelectStructure: (idx: number | null) => void
  onDeleteStructure: (idx: number) => void
  onDeleteSpawn: (type: 'T' | 'CT', idx: number) => void
  topSnapRef: React.MutableRefObject<TopSnapRef | null>
}) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const dragStart = useRef<{ x: number; z: number; px: number; pz: number } | null>(null)
  const [dragCur, setDragCur] = useState<{ x: number; z: number } | null>(null)
  const isMaterial = STRUCTURE_MATERIALS.includes(tool as StructureMaterial)

  const a = zone.arenaSize

  const borderGeom = React.useMemo(
    () => new THREE.BoxGeometry(a * 2, 0.01, a * 2),
    [a]
  )

  React.useEffect(() => {
    topSnapRef.current = {
      snap: () => {
        const a = zone.arenaSize
        camera.position.set(0, a * 3, 0.001)
        camera.lookAt(0, 0, 0)
        controlsRef.current?.update()
      },
    }
    return () => { topSnapRef.current = null }
  }, [camera, zone.arenaSize, topSnapRef])

  function onFloorDown(e: ThreeEvent<PointerEvent>) {
    if (e.button !== 0) return
    e.stopPropagation()
    const x = snapToGrid(e.point.x), z = snapToGrid(e.point.z)
    dragStart.current = { x, z, px: e.nativeEvent.clientX, pz: e.nativeEvent.clientY }
    setDragCur({ x, z })
  }

  function onFloorMove(e: ThreeEvent<PointerEvent>) {
    if (!dragStart.current) return
    setDragCur({ x: snapToGrid(e.point.x), z: snapToGrid(e.point.z) })
  }

  function onFloorUp(e: ThreeEvent<PointerEvent>) {
    const ds = dragStart.current
    dragStart.current = null
    setDragCur(null)
    if (!ds) return

    const dx = e.nativeEvent.clientX - ds.px
    const dz = e.nativeEvent.clientY - ds.pz
    const isDrag = Math.sqrt(dx * dx + dz * dz) > 5
    const x = snapToGrid(e.point.x), z = snapToGrid(e.point.z)

    if (isMaterial) {
      if (isDrag) {
        const ax = Math.min(ds.x, x), bx = Math.max(ds.x, x)
        const az = Math.min(ds.z, z), bz = Math.max(ds.z, z)
        const mat = tool as StructureMaterial
        const h = DEFAULT_HEIGHT[mat]
        onPlaceStructure({
          center: [(ax + bx) / 2, h / 2, (az + bz) / 2],
          size: [Math.max(1, bx - ax), h, Math.max(1, bz - az)],
          material: mat,
        })
      } else {
        onSelectStructure(null)
      }
    } else if (tool === 'tspawn') onPlaceSpawn('T', x, z)
    else if (tool === 'ctspawn') onPlaceSpawn('CT', x, z)
    else if (tool === 'bombA') onMoveBombsite('A', x, z)
    else if (tool === 'bombB') onMoveBombsite('B', x, z)
    else onSelectStructure(null)
  }

  const preview = (() => {
    if (!dragStart.current || !dragCur || !isMaterial) return null
    const ax = Math.min(dragStart.current.x, dragCur.x), bx = Math.max(dragStart.current.x, dragCur.x)
    const az = Math.min(dragStart.current.z, dragCur.z), bz = Math.max(dragStart.current.z, dragCur.z)
    const mat = tool as StructureMaterial
    const h = DEFAULT_HEIGHT[mat]
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, w: Math.max(1, bx - ax), d: Math.max(1, bz - az), h, mat }
  })()

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        mouseButtons={{
          LEFT: -1 as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
      <ambientLight color={zone.lighting.ambientColor} intensity={zone.lighting.ambientIntensity} />
      <directionalLight color={zone.lighting.sunColor} intensity={zone.lighting.sunIntensity}
        position={zone.lighting.sunPosition} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onFloorDown} onPointerMove={onFloorMove} onPointerUp={onFloorUp}>
        <planeGeometry args={[a * 2, a * 2]} />
        <meshStandardMaterial color={`#${zone.floorColor.toString(16).padStart(6, '0')}`} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[a * 2, Math.round((a * 2) / 5), '#2a2a3a', '#2a2a3a']} position={[0, 0.01, 0]} />

      {/* Arena border */}
      <lineSegments position={[0, 0.02, 0]}>
        <edgesGeometry args={[borderGeom]} />
        <lineBasicMaterial color="#ff6600" />
      </lineSegments>

      {/* Structures */}
      {zone.structures.map((s, i) => (
        <mesh key={i} position={[s.center[0], s.center[1], s.center[2]]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            tool === 'eraser' ? onDeleteStructure(i) : onSelectStructure(i)
          }}>
          <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />
          <meshStandardMaterial color={MATERIAL_COLOR[s.material]}
            emissive={MATERIAL_COLOR[s.material]} emissiveIntensity={selectedIdx === i ? 0.4 : 0} />
        </mesh>
      ))}

      {/* Drag preview */}
      {preview && (
        <mesh position={[preview.cx, preview.h / 2, preview.cz]}>
          <boxGeometry args={[preview.w, preview.h, preview.d]} />
          <meshStandardMaterial color={MATERIAL_COLOR[preview.mat]} opacity={0.5} transparent />
        </mesh>
      )}

      {/* T spawns */}
      {zone.tSpawns.map(([x, z], i) => (
        <mesh key={`t${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (tool === 'eraser') onDeleteSpawn('T', i) }}>
          <circleGeometry args={[1.5, 16]} />
          <meshBasicMaterial color="#ff8c00" opacity={0.7} transparent />
        </mesh>
      ))}

      {/* CT spawns */}
      {zone.ctSpawns.map(([x, z], i) => (
        <mesh key={`ct${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (tool === 'eraser') onDeleteSpawn('CT', i) }}>
          <circleGeometry args={[1.5, 16]} />
          <meshBasicMaterial color="#3c78ff" opacity={0.7} transparent />
        </mesh>
      ))}

      {/* Bombsites */}
      {zone.bombsites.map((b) => (
        <mesh key={b.id} position={[b.center[0], 0.05, b.center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3, 4, 32]} />
          <meshBasicMaterial color={b.id === 'A' ? '#ff3232' : '#32c832'}
            opacity={0.5} transparent side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

export function MapEditorCanvas({
  zone, tool, selectedIdx, topSnapRef,
  onPlaceStructure, onPlaceSpawn, onMoveBombsite,
  onSelectStructure, onDeleteStructure, onDeleteSpawn,
}: {
  zone: ZoneDef; tool: Tool; selectedIdx: number | null
  topSnapRef: React.MutableRefObject<TopSnapRef | null>
  onPlaceStructure: (s: ZoneStructure) => void
  onPlaceSpawn: (type: 'T' | 'CT', x: number, z: number) => void
  onMoveBombsite: (id: 'A' | 'B', x: number, z: number) => void
  onSelectStructure: (idx: number | null) => void
  onDeleteStructure: (idx: number) => void
  onDeleteSpawn: (type: 'T' | 'CT', idx: number) => void
}) {
  const a = zone.arenaSize
  const skyHex = `#${(zone.skyColor ?? 0x87ceeb).toString(16).padStart(6, '0')}`
  return (
    <Canvas camera={{ position: [0, a * 1.5, a * 1.5], fov: 60 }} style={{ background: skyHex }}>
      <SceneContent
        zone={zone} tool={tool} selectedIdx={selectedIdx} topSnapRef={topSnapRef}
        onPlaceStructure={onPlaceStructure} onPlaceSpawn={onPlaceSpawn}
        onMoveBombsite={onMoveBombsite} onSelectStructure={onSelectStructure}
        onDeleteStructure={onDeleteStructure} onDeleteSpawn={onDeleteSpawn}
      />
    </Canvas>
  )
}
