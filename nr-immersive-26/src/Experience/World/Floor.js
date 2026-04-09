import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Floor {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    this.geometry = new THREE.PlaneGeometry(200, 200, 100, 100)
    this.material = new THREE.MeshStandardMaterial({
      color: '#1a2e1a',
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 1.0,
    })
    
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.rotation.x = -Math.PI * 0.5
    this.mesh.position.y = 0
    this.scene.add(this.mesh)
    
    this.targetOpacity = 1.0
  }
  
  // Fade floor for underground view
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
    // Smooth opacity transition
    this.material.opacity += (this.targetOpacity - this.material.opacity) * 0.05
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.scene.remove(this.mesh)
  }
}
