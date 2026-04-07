import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Environment {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.setSunLight()
    this.setAmbientLight()
    this.setFog()
  }

  setSunLight() {
    this.sunLight = new THREE.DirectionalLight('#ffffff', 1.5)
    this.sunLight.position.set(10, 20, 10)
    this.scene.add(this.sunLight)
  }

  setAmbientLight() {
    this.ambientLight = new THREE.AmbientLight('#b0d0b0', 0.8)
    this.scene.add(this.ambientLight)
  }

  setFog() {
    this.scene.fog = new THREE.Fog('#0a0f0a', 30, 100)
  }

  dispose() {
    this.scene.remove(this.sunLight)
    this.scene.remove(this.ambientLight)
  }
}
