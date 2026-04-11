import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import Experience from '../Experience.js'
import { WORLD_GROUND_LEVEL_Y } from './worldGroundLevel.js'
import particlesVertexShader from './Shaders/forestParticlesVertex.glsl?raw'
import particlesFragmentShader from './Shaders/forestParticlesFragment.glsl?raw'
import gpgpuParticlesShader from './Shaders/forestGpgpuParticles.glsl?raw'

export default class Forest {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.renderer = this.experience.renderer.instance
    this.sizes = this.experience.sizes
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.targetDistance = 60
    this.scenePositions = {
      left: new THREE.Vector3(
        -this.targetDistance * Math.sin(Math.PI * 2 / 3),
        0,
        -this.targetDistance * Math.cos(Math.PI * 2 / 3)
      ),
      right: new THREE.Vector3(
        -this.targetDistance * Math.sin(-Math.PI * 2 / 3),
        0,
        -this.targetDistance * Math.cos(-Math.PI * 2 / 3)
      )
    }

    this.settings = {
      treeCount: 165,
      forestRadius: 80,
      clearingRadius: 4.5,
      surfaceSampleCount: 34000,
      treeScaleTarget: 20.8, // 2× prior 10.4 (spatial extent of each sampled tree)
      particlesPerTree: 1350, // denser forest
      maxParticles: 260000,
      pointSize: 0.022, // 2× prior; screen-space splat size
      decaySpeed: 0.35,
      lifeMix: 0.18,
      minPointSize: 1.4,
      maxPointSize: 14.0,
      scaleMin: 0.72,
      scaleMax: 1.28,
      /** Added to floor Y; negative sinks particle trees toward the floor, positive lifts them. */
      treesYOffset: 0
    }
    this.settings.resampleNow = () => this.rebuildForest()

    this.dreamyColors = {
      trunkLow: '#1d5bff',
      trunkHigh: '#7dd3ff',
      canopyLow: '#7a62ff',
      canopyHigh: '#f3a9ff',
      sparkle: '#ffffff',
      canopyMixStart: 0.45,
      canopyMixEnd: 0.82,
      sparkleAmount: 0.08,
      hueWave: 0.15
    }

    this.loader = new GLTFLoader()
    this.dracoLoader = new DRACOLoader()
    this.dracoLoader.setDecoderPath('/draco/')
    this.loader.setDRACOLoader(this.dracoLoader)
    this.points = null
    this.particlePositions = null
    this.particleRigidity = null
    this.gpgpu = null
    this.debugSetupDone = false

    this.loadParticleTreeModel()
  }

  loadParticleTreeModel() {
    this.loader.load('/low_poly_tree/scene.gltf', (gltf) => {
      const baseTree = this.extractTreeData(gltf.scene)
      if (!baseTree) return
      this.buildForest(baseTree)
      if (this.debug.active && !this.debugSetupDone) {
        this.setDebug()
        this.debugSetupDone = true
      }
    }, undefined, (error) => {
      console.error('Failed to load /low_poly_tree/scene.gltf', error)
    })
  }

  extractTreeData(root) {
    root.updateWorldMatrix(true, true)
    const meshes = []
    root.traverse((child) => {
      if (!child.isMesh || !child.geometry || !child.geometry.getAttribute('position')) return
      const material = Array.isArray(child.material) ? child.material[0] : child.material
      const color = material?.color ? material.color.clone() : new THREE.Color('#9acb99')
      meshes.push({
        mesh: child,
        sampler: new MeshSurfaceSampler(child).build(),
        color
      })
    })
    if (!meshes.length) return null

    const sampled = []
    const temp = new THREE.Vector3()
    for (const info of meshes) {
      const count = Math.max(120, Math.floor(this.settings.surfaceSampleCount / meshes.length))
      for (let i = 0; i < count; i++) {
        info.sampler.sample(temp)
        temp.applyMatrix4(info.mesh.matrixWorld)
        sampled.push({
          x: temp.x,
          y: temp.y,
          z: temp.z,
          color: info.color
        })
      }
    }
    if (!sampled.length) return null

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (const p of sampled) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); minZ = Math.min(minZ, p.z)
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); maxZ = Math.max(maxZ, p.z)
    }
    const center = new THREE.Vector3((minX + maxX) * 0.5, minY, (minZ + maxZ) * 0.5)
    const maxSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
    const scale = this.settings.treeScaleTarget / maxSize

    const positions = new Float32Array(sampled.length * 3)
    const colors = new Float32Array(sampled.length * 3)
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i]
      positions[i * 3 + 0] = (p.x - center.x) * scale
      positions[i * 3 + 1] = (p.y - center.y) * scale
      positions[i * 3 + 2] = (p.z - center.z) * scale
      colors[i * 3 + 0] = p.color.r
      colors[i * 3 + 1] = p.color.g
      colors[i * 3 + 2] = p.color.b
    }

    const rigidity = this.computeRigidity(positions)
    return { positions, colors, rigidity, count: sampled.length }
  }

  rebuildForest() {
    this.disposeForestOnly()
    this.loadParticleTreeModel()
  }

  computeRigidity(positions) {
    const box = new THREE.Box3().setFromArray(positions)
    const minY = box.min.y
    const maxY = box.max.y
    const heightRange = Math.max(0.0001, maxY - minY)
    let maxRadius = 0.0001
    for (let i = 0; i < positions.length; i += 3) {
      const r = Math.hypot(positions[i], positions[i + 2])
      if (r > maxRadius) maxRadius = r
    }
    const rigidity = new Float32Array(positions.length / 3)
    for (let i = 0; i < rigidity.length; i++) {
      const x = positions[i * 3 + 0]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      const h = THREE.MathUtils.clamp((y - minY) / heightRange, 0, 1)
      const rNorm = Math.hypot(x, z) / maxRadius
      const trunkCore =
        (1 - THREE.MathUtils.smoothstep(rNorm, 0.22, 0.48)) *
        (1 - THREE.MathUtils.smoothstep(h, 0.72, 0.95))
      let value = THREE.MathUtils.clamp(trunkCore, 0, 1)
      if (h < 0.2) value = Math.max(value, 0.85)
      if (h > 0.84) value *= 0.3
      rigidity[i] = value
    }
    return rigidity
  }

  buildForest(baseTree) {
    const centers = this.generateForestCenters()
    const treeCount = centers.length
    const perTree = Math.max(1, Math.floor(this.settings.maxParticles / Math.max(treeCount, 1)))
    const particlesPerTree = Math.min(this.settings.particlesPerTree, perTree)
    const finalCount = treeCount * particlesPerTree

    const positions = new Float32Array(finalCount * 3)
    const colors = new Float32Array(finalCount * 3)
    const rigidity = new Float32Array(finalCount)

    const tmp = new THREE.Vector3()
    const scratchXs = new Float32Array(particlesPerTree)
    const scratchZs = new Float32Array(particlesPerTree)
    const scratchYl = new Float32Array(particlesPerTree)
    const scratchSrc = new Uint32Array(particlesPerTree)

    let write = 0
    for (const center of centers) {
      const scale = THREE.MathUtils.lerp(this.settings.scaleMin, this.settings.scaleMax, Math.random())
      const yaw = Math.random() * Math.PI * 2
      const cosY = Math.cos(yaw)
      const sinY = Math.sin(yaw)

      // Per tree: lowest sample sits at local Y=0 so bases align with the flat floor
      // (WORLD_GROUND_LEVEL_Y on the Points mesh). No sine terrain on Y — it fought the
      // single floor plane and made distant trees look like they floated.
      let treeMinLocalY = Infinity
      for (let i = 0; i < particlesPerTree; i++) {
        const src = (Math.random() * baseTree.count) | 0
        scratchSrc[i] = src
        tmp.set(
          baseTree.positions[src * 3 + 0],
          baseTree.positions[src * 3 + 1],
          baseTree.positions[src * 3 + 2]
        ).multiplyScalar(scale)

        const x = tmp.x * cosY - tmp.z * sinY
        const z = tmp.x * sinY + tmp.z * cosY
        scratchXs[i] = x
        scratchZs[i] = z
        scratchYl[i] = tmp.y
        if (tmp.y < treeMinLocalY) treeMinLocalY = tmp.y
      }

      for (let i = 0; i < particlesPerTree; i++) {
        const src = scratchSrc[i]
        positions[write * 3 + 0] = center.x + scratchXs[i]
        positions[write * 3 + 1] = scratchYl[i] - treeMinLocalY
        positions[write * 3 + 2] = center.z + scratchZs[i]

        colors[write * 3 + 0] = baseTree.colors[src * 3 + 0]
        colors[write * 3 + 1] = baseTree.colors[src * 3 + 1]
        colors[write * 3 + 2] = baseTree.colors[src * 3 + 2]
        rigidity[write] = baseTree.rigidity[src]
        write++
      }
    }

    this.particlePositions = positions
    this.particleRigidity = rigidity
    this.setupGpgpu(positions)
    this.createParticlesGeometry(finalCount, colors, rigidity)
    this.updateDreamyColors()
  }

  setupGpgpu(positions) {
    const count = positions.length / 3
    const size = Math.ceil(Math.sqrt(count))
    const compute = new GPUComputationRenderer(size, size, this.renderer)
    const baseTexture = compute.createTexture()
    const data = baseTexture.image.data
    for (let i = 0; i < size * size; i++) {
      const i4 = i * 4
      const src = (i % count) * 3
      data[i4 + 0] = positions[src + 0]
      data[i4 + 1] = positions[src + 1]
      data[i4 + 2] = positions[src + 2]
      data[i4 + 3] = Math.random()
    }

    const particlesVariable = compute.addVariable('uParticles', gpgpuParticlesShader, baseTexture)
    compute.setVariableDependencies(particlesVariable, [particlesVariable])
    particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
    particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
    particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseTexture)
    particlesVariable.material.uniforms.uDecaySpeed = new THREE.Uniform(this.settings.decaySpeed)
    const initError = compute.init()
    if (initError) {
      console.error('GPUComputationRenderer init error:', initError)
      this.gpgpu = {
        compute: null,
        particlesVariable: null,
        size,
        count,
        fallbackTexture: baseTexture
      }
      return
    }

    this.gpgpu = { compute, particlesVariable, size, count, fallbackTexture: baseTexture }
  }

  createParticlesGeometry(count, colors, rigidity) {
    const size = this.gpgpu.size
    const particlesUvArray = new Float32Array(count * 2)
    const sizesArray = new Float32Array(count)
    const colorArray = new Float32Array(colors)
    const rigidityArray = new Float32Array(rigidity)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        if (i >= count) break
        particlesUvArray[i * 2 + 0] = (x + 0.5) / size
        particlesUvArray[i * 2 + 1] = (y + 0.5) / size
        const rigid = rigidityArray[i]
        sizesArray[i] = THREE.MathUtils.lerp(0.48, 0.9, rigid) + Math.random() * 0.12
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setDrawRange(0, count)
    geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArray, 3))
    geometry.setAttribute('aRigidity', new THREE.BufferAttribute(rigidityArray, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader: particlesVertexShader,
      fragmentShader: particlesFragmentShader,
      uniforms: {
        uSize: new THREE.Uniform(this.settings.pointSize),
        uResolution: new THREE.Uniform(new THREE.Vector2(
          this.sizes.width * this.sizes.pixelRatio,
          this.sizes.height * this.sizes.pixelRatio
        )),
        uParticlesTexture: new THREE.Uniform(null),
        uLifeMix: new THREE.Uniform(this.settings.lifeMix),
        uMinPointSize: new THREE.Uniform(this.settings.minPointSize),
        uMaxPointSize: new THREE.Uniform(this.settings.maxPointSize)
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    })

    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    material.uniforms.uParticlesTexture.value = this.gpgpu.fallbackTexture
    this.scene.add(this.points)
    this.applyTreesGroundOffset()
  }

  applyTreesGroundOffset() {
    if (!this.points) return
    this.points.position.y = WORLD_GROUND_LEVEL_Y + this.settings.treesYOffset
  }

  generateForestCenters() {
    const centers = []
    const exclusionZones = [
      { center: this.scenePositions.left.clone(), radius: 16 },
      { center: this.scenePositions.right.clone(), radius: 20 }
    ]
    const pathExclusionWidth = 4.2

    let placed = 0
    const maxAttempts = this.settings.treeCount * 5
    for (let i = 0; i < maxAttempts && placed < this.settings.treeCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * this.settings.forestRadius + 3
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.hypot(x, z) < this.settings.clearingRadius) continue

      let blocked = false
      for (const zone of exclusionZones) {
        if (Math.hypot(x - zone.center.x, z - zone.center.z) < zone.radius) {
          blocked = true
          break
        }
      }
      if (blocked) continue

      for (const scenePos of Object.values(this.scenePositions)) {
        const dir = new THREE.Vector2(scenePos.x, scenePos.z).normalize()
        const p = new THREE.Vector2(x, z)
        const proj = p.dot(dir)
        if (proj > 0 && proj < this.targetDistance) {
          const projPoint = dir.clone().multiplyScalar(proj)
          if (p.distanceTo(projPoint) < pathExclusionWidth) {
            blocked = true
            break
          }
        }
      }
      if (blocked) continue

      centers.push(new THREE.Vector3(x, 0, z))
      placed++
    }
    return centers
  }

  updateDreamyColors() {
    if (!this.points || !this.particlePositions || !this.particleRigidity) return
    const colorAttr = this.points.geometry.getAttribute('aColor')
    if (!colorAttr) return

    const trunkLow = new THREE.Color(this.dreamyColors.trunkLow)
    const trunkHigh = new THREE.Color(this.dreamyColors.trunkHigh)
    const canopyLow = new THREE.Color(this.dreamyColors.canopyLow)
    const canopyHigh = new THREE.Color(this.dreamyColors.canopyHigh)
    const sparkle = new THREE.Color(this.dreamyColors.sparkle)

    const box = new THREE.Box3().setFromArray(this.particlePositions)
    const minY = box.min.y
    const maxY = box.max.y
    const heightRange = Math.max(0.0001, maxY - minY)
    const c1 = new THREE.Color()
    const c2 = new THREE.Color()
    const final = new THREE.Color()
    const hsl = { h: 0, s: 0, l: 0 }

    for (let i = 0; i < colorAttr.count; i++) {
      const x = this.particlePositions[i * 3 + 0]
      const y = this.particlePositions[i * 3 + 1]
      const z = this.particlePositions[i * 3 + 2]
      const rigid = this.particleRigidity[i]
      const h = THREE.MathUtils.clamp((y - minY) / heightRange, 0, 1)

      const canopyT = THREE.MathUtils.smoothstep(h, this.dreamyColors.canopyMixStart, this.dreamyColors.canopyMixEnd)
      c1.copy(trunkLow).lerp(trunkHigh, h)
      c2.copy(canopyLow).lerp(canopyHigh, h)
      final.copy(c1).lerp(c2, canopyT * (1 - rigid * 0.7))

      const wave = Math.sin((x * 2.2 + z * 2.8 + y * 0.8) * 2.3) * this.dreamyColors.hueWave
      final.getHSL(hsl)
      final.setHSL((hsl.h + wave + 1) % 1, THREE.MathUtils.clamp(hsl.s + 0.06 - rigid * 0.03, 0, 1), hsl.l)

      const hash = this.fract(Math.sin((x * 12.9898) + (y * 78.233) + (z * 37.719)) * 43758.5453)
      if (hash < this.dreamyColors.sparkleAmount * (0.2 + h * 0.8) * (1 - rigid * 0.9)) {
        final.lerp(sparkle, 0.65)
      }

      colorAttr.setXYZ(i, final.r, final.g, final.b)
    }

    colorAttr.needsUpdate = true
  }

  fract(value) {
    return value - Math.floor(value)
  }

  setDebug() {
    const folder = this.debug.ui.addFolder('Forest Particles')
    folder.add(this.settings, 'treeScaleTarget', 3.0, 40.0, 0.1).name('treeScale')
    folder.add(this.settings, 'treeCount', 50, 260, 1).name('treeCount')
    folder.add(this.settings, 'particlesPerTree', 200, 2600, 10).name('particlesPerTree')
    folder.add(this.settings, 'scaleMin', 0.3, 2.0, 0.01).name('scaleMin')
    folder.add(this.settings, 'scaleMax', 0.3, 2.5, 0.01).name('scaleMax')
    folder
      .add(this.settings, 'treesYOffset', -8, 8, 0.05)
      .name('Trees Y vs floor')
      .onChange(() => this.applyTreesGroundOffset())
    folder.add(this.settings, 'resampleNow').name('Resample Now')
    folder.add(this.settings, 'pointSize', 0.002, 0.06, 0.0005).name('pointSize')
      .onChange(() => this.points?.material?.uniforms.uSize && (this.points.material.uniforms.uSize.value = this.settings.pointSize))
    folder.add(this.settings, 'decaySpeed', 0.05, 1.5, 0.001).name('decaySpeed')
    folder.add(this.settings, 'lifeMix', 0.0, 1.0, 0.001).name('lifeMix')
    folder.add(this.settings, 'minPointSize', 0.2, 6.0, 0.01).name('minPointSize')
    folder.add(this.settings, 'maxPointSize', 2.0, 28.0, 0.1).name('maxPointSize')
    folder.addColor(this.dreamyColors, 'trunkLow').name('trunkLow').onChange(() => this.updateDreamyColors())
    folder.addColor(this.dreamyColors, 'trunkHigh').name('trunkHigh').onChange(() => this.updateDreamyColors())
    folder.addColor(this.dreamyColors, 'canopyLow').name('canopyLow').onChange(() => this.updateDreamyColors())
    folder.addColor(this.dreamyColors, 'canopyHigh').name('canopyHigh').onChange(() => this.updateDreamyColors())
    folder.addColor(this.dreamyColors, 'sparkle').name('sparkle').onChange(() => this.updateDreamyColors())
    folder.add(this.dreamyColors, 'canopyMixStart', 0.0, 1.0, 0.001).name('canopyMixStart').onChange(() => this.updateDreamyColors())
    folder.add(this.dreamyColors, 'canopyMixEnd', 0.0, 1.0, 0.001).name('canopyMixEnd').onChange(() => this.updateDreamyColors())
    folder.add(this.dreamyColors, 'sparkleAmount', 0.0, 0.4, 0.001).name('sparkleAmount').onChange(() => this.updateDreamyColors())
    folder.add(this.dreamyColors, 'hueWave', 0.0, 0.5, 0.001).name('hueWave').onChange(() => this.updateDreamyColors())
  }

  update() {
    if (!this.gpgpu || !this.points) return

    const deltaTime = Math.min(this.time.delta / 1000, 0.1)
    const elapsed = this.time.elapsed / 1000
    const material = this.points.material

    material.uniforms.uSize.value = this.settings.pointSize
    material.uniforms.uLifeMix.value = this.settings.lifeMix
    material.uniforms.uMinPointSize.value = this.settings.minPointSize
    material.uniforms.uMaxPointSize.value = this.settings.maxPointSize
    material.uniforms.uResolution.value.set(
      this.sizes.width * this.sizes.pixelRatio,
      this.sizes.height * this.sizes.pixelRatio
    )

    if (!this.gpgpu.compute || !this.gpgpu.particlesVariable) {
      material.uniforms.uParticlesTexture.value = this.gpgpu.fallbackTexture
      return
    }

    const variable = this.gpgpu.particlesVariable
    variable.material.uniforms.uTime.value = elapsed
    variable.material.uniforms.uDeltaTime.value = deltaTime
    variable.material.uniforms.uDecaySpeed.value = this.settings.decaySpeed
    this.gpgpu.compute.compute()
    material.uniforms.uParticlesTexture.value = this.gpgpu.compute.getCurrentRenderTarget(variable).texture
  }

  disposeForestOnly() {
    if (this.points) {
      this.points.geometry.dispose()
      this.points.material.dispose()
      this.scene.remove(this.points)
      this.points = null
    }
    if (this.gpgpu?.compute?.dispose) this.gpgpu.compute.dispose()
    this.gpgpu = null
    this.particlePositions = null
    this.particleRigidity = null
  }

  dispose() {
    this.disposeForestOnly()
  }
}
