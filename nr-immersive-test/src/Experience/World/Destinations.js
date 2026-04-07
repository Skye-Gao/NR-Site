import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Destinations {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    // Distance from center (same as Navigation.js)
    const targetDistance = 60

    // Equilateral triangle positions (matching Navigation.js)
    // Cube at back-left (120° from front)
    this.leftPosition = new THREE.Vector3(
      -targetDistance * Math.sin(Math.PI * 2 / 3),
      0,
      -targetDistance * Math.cos(Math.PI * 2 / 3)
    )
    
    // Sphere at back-right (-120° from front)
    this.rightPosition = new THREE.Vector3(
      -targetDistance * Math.sin(-Math.PI * 2 / 3),
      0,
      -targetDistance * Math.cos(-Math.PI * 2 / 3)
    )

    // Commented out - replaced by PanelTalkScene and LivestreamScene
    // this.createLeftCube()
    // this.createRightSphere()
  }

  /*
  createLeftCube() {
    const geometry = new THREE.BoxGeometry(5, 5, 5)
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
      metalness: 0.1,
      emissive: '#ffffff',
      emissiveIntensity: 0.1,
    })
    
    this.leftCube = new THREE.Mesh(geometry, material)
    this.leftCube.position.copy(this.leftPosition)
    this.leftCube.position.y = 2.5
    this.scene.add(this.leftCube)

    this.leftCubeGeometry = geometry
    this.leftCubeMaterial = material
  }

  createRightSphere() {
    const geometry = new THREE.SphereGeometry(3, 32, 32)
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
      metalness: 0.1,
      emissive: '#ffffff',
      emissiveIntensity: 0.1,
    })
    
    this.rightSphere = new THREE.Mesh(geometry, material)
    this.rightSphere.position.copy(this.rightPosition)
    this.rightSphere.position.y = 3
    this.scene.add(this.rightSphere)

    this.rightSphereGeometry = geometry
    this.rightSphereMaterial = material
  }
  */

  update() {
    /*
    const time = this.experience.time.elapsed * 0.001
    
    if (this.leftCube) {
      this.leftCube.rotation.y = time * 0.5
      this.leftCube.position.y = 2.5 + Math.sin(time) * 0.3
    }
    
    if (this.rightSphere) {
      this.rightSphere.position.y = 3 + Math.sin(time + 1) * 0.3
    }
    */
  }

  dispose() {
    /*
    this.leftCubeGeometry.dispose()
    this.leftCubeMaterial.dispose()
    this.scene.remove(this.leftCube)

    this.rightSphereGeometry.dispose()
    this.rightSphereMaterial.dispose()
    this.scene.remove(this.rightSphere)
    */
  }
}
