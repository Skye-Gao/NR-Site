import * as THREE from 'three'
import Experience from './Experience.js'

export default class Camera {
  constructor() {
    this.experience = new Experience()
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene

    // Overhead third-person behind the sphere
    this.distance = 8          // Distance behind
    this.height = 6            // Height above
    this.lookAheadDist = 2     // Look slightly ahead of the sphere
    this.lookAtHeight = 0.3
    this.positionSmoothing = 0.045
    this.rotationSmoothing = 0.04

    this.currentAngle = 0      // Current orbit angle (follows player rotation)
    this.currentPosition = new THREE.Vector3(0, this.height, this.distance)
    this.currentLookAt = new THREE.Vector3(0, 0, 0)

    this.setInstance()
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      55,
      this.sizes.width / this.sizes.height,
      0.1,
      200
    )
    this.instance.position.copy(this.currentPosition)
    this.instance.lookAt(0, 0, 0)
    this.scene.add(this.instance)
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    const player = this.experience.world?.player
    if (!player) return

    // Follow behind the player's facing direction
    const targetAngle = player.rotation + Math.PI
    let angleDiff = targetAngle - this.currentAngle
    angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    this.currentAngle += angleDiff * this.rotationSmoothing

    // Position behind the player
    const targetPosition = new THREE.Vector3(
      player.position.x + Math.sin(this.currentAngle) * this.distance,
      player.position.y + this.height,
      player.position.z + Math.cos(this.currentAngle) * this.distance
    )

    // Look ahead of the player in movement direction
    const targetLookAt = new THREE.Vector3(
      player.position.x - Math.sin(this.currentAngle) * this.lookAheadDist,
      player.position.y + this.lookAtHeight,
      player.position.z - Math.cos(this.currentAngle) * this.lookAheadDist
    )

    this.currentPosition.lerp(targetPosition, this.positionSmoothing)
    this.currentLookAt.lerp(targetLookAt, this.positionSmoothing)

    this.instance.position.copy(this.currentPosition)
    this.instance.lookAt(this.currentLookAt)
  }

  dispose() {}
}
