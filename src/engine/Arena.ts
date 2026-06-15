import * as THREE from 'three'

export function createArena(scene: THREE.Scene) {
  const floorGeo = new THREE.PlaneGeometry(60, 60)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x333344,
    roughness: 0.8,
    metalness: 0.2,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x444455,
    roughness: 0.6,
    metalness: 0.3,
  })

  const wallHeight = 5
  const arenaSize = 30

  const walls = [
    { pos: [0, wallHeight / 2, -arenaSize], rot: [0, 0, 0], size: [arenaSize * 2, wallHeight, 0.5] },
    { pos: [0, wallHeight / 2, arenaSize], rot: [0, 0, 0], size: [arenaSize * 2, wallHeight, 0.5] },
    { pos: [-arenaSize, wallHeight / 2, 0], rot: [0, Math.PI / 2, 0], size: [arenaSize * 2, wallHeight, 0.5] },
    { pos: [arenaSize, wallHeight / 2, 0], rot: [0, Math.PI / 2, 0], size: [arenaSize * 2, wallHeight, 0.5] },
  ]

  for (const w of walls) {
    const geo = new THREE.BoxGeometry(...w.size)
    const mesh = new THREE.Mesh(geo, wallMat)
    mesh.position.set(...(w.pos as [number, number, number]))
    mesh.rotation.set(...(w.rot as [number, number, number]))
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(10, 20, 10)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 100
  dirLight.shadow.camera.left = -40
  dirLight.shadow.camera.right = 40
  dirLight.shadow.camera.top = 40
  dirLight.shadow.camera.bottom = -40
  scene.add(dirLight)

  const pointLight = new THREE.PointLight(0xff6600, 0.8, 50)
  pointLight.position.set(0, 8, 0)
  scene.add(pointLight)
}
