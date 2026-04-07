import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Environment {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    this.setSunLight()
    this.setAmbientLight()
    this.setFog()

    if (this.debug.active) this.setDebug()
  }

  setSunLight() {
    this.sunLight = new THREE.DirectionalLight('#ffffff', 5)
    this.sunLight.position.set(5, 10, 7)
    this.scene.add(this.sunLight)
  }

  setAmbientLight() {
    this.ambientLight = new THREE.AmbientLight('#ffffff', 2)
    this.scene.add(this.ambientLight)
  }

  setFog() {
    this.scene.fog = new THREE.Fog('#0a1a0a', 0, 74.6)
  }

  setDebug() {
    const folder = this.debug.ui.addFolder('Environment')
    folder.add(this.sunLight, 'intensity').min(0).max(10).step(0.1).name('Sun')
    folder.add(this.ambientLight, 'intensity').min(0).max(5).step(0.1).name('Ambient')
    folder.add(this.scene.fog, 'near').min(0).max(50).step(0.1).name('Fog Near')
    folder.add(this.scene.fog, 'far').min(10).max(150).step(0.1).name('Fog Far')
  }

  dispose() {
    this.scene.remove(this.sunLight)
    this.scene.remove(this.ambientLight)
    this.scene.fog = null
  }
}
