import * as THREE from 'three'
import Experience from '../Experience.js'
import { WORLD_GROUND_LEVEL_Y } from './worldGroundLevel.js'
import floorTerrainVertexShader from './Shaders/floorTerrainVertex.glsl?raw'
import floorTerrainFragmentShader from './Shaders/floorTerrainFragment.glsl?raw'

const TERRAIN_SIZE = 200
/** Dense bed (~2× count vs 280²: √2 segments per axis) */
const TERRAIN_SEGMENTS = Math.round(280 * Math.SQRT2)
/** Vertical “data spike” columns (scaled with bed density) */
const SPIKE_COLUMNS = Math.round(440 * Math.SQRT2)
const SPIKE_STEPS_MIN = 26
const SPIKE_STEPS_MAX = 78

/** Multi-scale undulation (local Y). */
function sampleTerrainHeight(x, z) {
  const n1 = Math.sin(x * 0.03) * Math.cos(z * 0.026)
  const n2 = Math.sin((x + z) * 0.0185 + 0.5) * 0.58
  const n3 = Math.cos((x - z) * 0.014 + 0.25) * 0.38
  const n4 = Math.sin(x * 0.062) * Math.cos(z * 0.056) * 0.32
  const n5 = Math.sin((x * 0.5 + z * 0.35) * 0.11) * 0.2
  const m = n1 * 0.34 + n2 * 0.26 + n3 * 0.18 + n4 * 0.14 + n5 * 0.08
  const t = (m * 0.5 + 0.5) * 0.98
  return Math.max(0.02, t)
}

export default class Floor {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.sizes = this.experience.sizes
    this.debug = this.experience.debug

    this._basePointScale = 0.036
    this.tweak = {
      pointScaleMul: 0.93,
      spikePointMul: 0.2,
      colorDark: '#a8ffd2',
      colorBright: '#bdd3ff',
      colorSpike: '#e0c7ff',
      bigWavesElevation: 2.9,
      bigWavesFrequency: 0.01,
      bigWavesSpeed: 0,
      smallWavesElevation: 0.8,
      smallWavesFrequency: 0.21,
      smallWavesSpeed: 0.5,
      terrainRelief: 0
    }

    this.group = new THREE.Group()
    this.group.position.y = WORLD_GROUND_LEVEL_Y
    this.scene.add(this.group)

    const pos = []
    const kinds = []
    const alongs = []
    const baseYs = []

    const seg = TERRAIN_SEGMENTS
    const cell = TERRAIN_SIZE / (seg - 1)
    const jitter = 0.1

    for (let ix = 0; ix < seg; ix++) {
      const zStagger = (ix % 2) * 0.5 * cell
      for (let iz = 0; iz < seg; iz++) {
        const u = ix / (seg - 1)
        const v = iz / (seg - 1)
        const x =
          (u - 0.5) * TERRAIN_SIZE + (Math.random() - 0.5) * jitter
        const z =
          (v - 0.5) * TERRAIN_SIZE + zStagger + (Math.random() - 0.5) * jitter
        const y = sampleTerrainHeight(x, z)
        pos.push(x, y, z)
        kinds.push(0)
        alongs.push(0)
        baseYs.push(y)
      }
    }

    let columns = 0
    let attempts = 0
    const maxAttempts = 20000
    while (columns < SPIKE_COLUMNS && attempts < maxAttempts) {
      attempts++
      const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.94
      const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.94
      const baseH = sampleTerrainHeight(x, z)
      if (baseH < 0.36 + Math.random() * 0.14) continue

      const colH = 2.0 + Math.random() * 10 + baseH * 7.5
      const steps =
        SPIKE_STEPS_MIN +
        Math.floor(Math.random() * (SPIKE_STEPS_MAX - SPIKE_STEPS_MIN))

      for (let k = 0; k < steps; k++) {
        const t = steps > 1 ? k / (steps - 1) : 0
        pos.push(
          x + (Math.random() - 0.5) * 0.26,
          baseH + t * colH,
          z + (Math.random() - 0.5) * 0.26
        )
        kinds.push(1)
        alongs.push(t)
        baseYs.push(baseH)
      }
      columns++
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1))
    geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(alongs, 1))
    geometry.setAttribute('aBaseY', new THREE.Float32BufferAttribute(baseYs, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader: floorTerrainVertexShader,
      fragmentShader: floorTerrainFragmentShader,
      uniforms: {
        uTime: new THREE.Uniform(0),
        uPointScale: new THREE.Uniform(this._basePointScale * this.sizes.pixelRatio),
        uSpikePointMul: new THREE.Uniform(this.tweak.spikePointMul),
        uBigWavesElevation: new THREE.Uniform(this.tweak.bigWavesElevation),
        uBigWavesFrequency: new THREE.Uniform(this.tweak.bigWavesFrequency),
        uBigWavesSpeed: new THREE.Uniform(this.tweak.bigWavesSpeed),
        uSmallWavesElevation: new THREE.Uniform(this.tweak.smallWavesElevation),
        uSmallWavesFrequency: new THREE.Uniform(this.tweak.smallWavesFrequency),
        uSmallWavesSpeed: new THREE.Uniform(this.tweak.smallWavesSpeed),
        uTerrainRelief: new THREE.Uniform(this.tweak.terrainRelief),
        uColorDark: new THREE.Uniform(new THREE.Color(this.tweak.colorDark)),
        uColorBright: new THREE.Uniform(new THREE.Color(this.tweak.colorBright)),
        uColorSpike: new THREE.Uniform(new THREE.Color(this.tweak.colorSpike)),
        uOpacity: new THREE.Uniform(1)
      },
      transparent: true,
      depthWrite: true,
      depthTest: true,
      toneMapped: true
    })

    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = -2
    this.group.add(this.points)

    this.geometry = geometry

    this.targetOpacity = 1.0

    this._onResize = () => this._syncPointScaleUniform()
    this.sizes.on('resize', this._onResize)

    if (this.debug?.ui) this.setupDebug()

    this._syncWaveUniforms()
  }

  _syncWaveUniforms() {
    if (!this.material) return
    const u = this.material.uniforms
    const t = this.tweak
    u.uBigWavesElevation.value = t.bigWavesElevation
    u.uBigWavesFrequency.value = t.bigWavesFrequency
    u.uBigWavesSpeed.value = t.bigWavesSpeed
    u.uSmallWavesElevation.value = t.smallWavesElevation
    u.uSmallWavesFrequency.value = t.smallWavesFrequency
    u.uSmallWavesSpeed.value = t.smallWavesSpeed
    u.uTerrainRelief.value = t.terrainRelief
  }

  _syncPointScaleUniform() {
    if (!this.material) return
    this.material.uniforms.uPointScale.value =
      this._basePointScale * this.sizes.pixelRatio * this.tweak.pointScaleMul
  }

  _syncFloorColors() {
    const u = this.material.uniforms
    u.uColorDark.value.set(this.tweak.colorDark)
    u.uColorBright.value.set(this.tweak.colorBright)
    u.uColorSpike.value.set(this.tweak.colorSpike)
  }

  setupDebug() {
    const folder = this.debug.ui.addFolder('Floor particles')
    folder.close()

    const t = this.tweak
    folder
      .add(t, 'pointScaleMul', 0.35, 2.4, 0.02)
      .name('Bed point ×')
      .onChange(() => this._syncPointScaleUniform())
    folder
      .add(t, 'spikePointMul', 0.2, 1.25, 0.02)
      .name('Spike thin ×')
      .onChange(() => {
        this.material.uniforms.uSpikePointMul.value = t.spikePointMul
      })

    folder.addColor(t, 'colorDark').name('Trough').onChange(() => this._syncFloorColors())
    folder.addColor(t, 'colorBright').name('Crest').onChange(() => this._syncFloorColors())
    folder.addColor(t, 'colorSpike').name('Spike').onChange(() => this._syncFloorColors())

    const waves = folder.addFolder('Waves (sea)')
    waves.close()
    waves
      .add(t, 'bigWavesElevation', 0, 5, 0.05)
      .name('Big amp')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'bigWavesFrequency', 0.01, 0.12, 0.002)
      .name('Big freq')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'bigWavesSpeed', 0, 8, 0.1)
      .name('Big speed')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'smallWavesElevation', 0, 2.5, 0.02)
      .name('Small amp')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'smallWavesFrequency', 0.04, 0.35, 0.005)
      .name('Small freq')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'smallWavesSpeed', 0, 10, 0.1)
      .name('Small speed')
      .onChange(() => this._syncWaveUniforms())
    waves
      .add(t, 'terrainRelief', 0, 1, 0.02)
      .name('Bed static ×')
      .onChange(() => this._syncWaveUniforms())

    this._debugFolder = folder
  }

  setOpacity(opacity) {
    this.targetOpacity = opacity
  }

  show() {
    this.targetOpacity = 1.0
  }

  hide() {
    this.targetOpacity = 0.0
  }

  update() {
    const u = this.material.uniforms
    u.uTime.value = this.experience.time.elapsed * 0.001
    const next = u.uOpacity.value + (this.targetOpacity - u.uOpacity.value) * 0.05
    u.uOpacity.value = next
  }

  dispose() {
    this.sizes.off('resize', this._onResize)
    this._debugFolder?.destroy()
    this.geometry.dispose()
    this.material.dispose()
    this.scene.remove(this.group)
  }
}
