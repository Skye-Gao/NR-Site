import * as THREE from 'three'
import Experience from './Experience.js'

export default class Renderer {
  constructor() {
    this.experience = new Experience()
    this.canvas = this.experience.canvas
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene
    this.camera = this.experience.camera

    /** Baseline ACES exposure; restored when leaving Panel Talk / Livestream */
    this.baseToneMappingExposure = 1
    /** Applied while Panel Talk or Livestream stage is active. */
    this.stageExposureBoost = 1.2

    this.setInstance()
  }

  setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.instance.outputColorSpace = THREE.SRGBColorSpace
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = this.baseToneMappingExposure
    this.instance.setClearColor('#0a0f0a')
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.sizes.pixelRatio)
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.sizes.pixelRatio)
  }

  update() {
    this.instance.render(this.scene, this.camera.instance)
  }

  /**
   * Slightly raises global tone-mapping exposure on Panel Talk / Livestream
   * so screens read less muddy; reset when leaving.
   */
  setStageExposureBoost(active) {
    if (!this.instance) return
    this.instance.toneMappingExposure = active
      ? this.baseToneMappingExposure * this.stageExposureBoost
      : this.baseToneMappingExposure
  }

  dispose() {
    this.instance.dispose()
  }
}
