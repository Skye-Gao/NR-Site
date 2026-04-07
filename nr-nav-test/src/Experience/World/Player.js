import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Player {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene

    // Player state
    this.position = new THREE.Vector3(0, 0.6, 0)
    this.rotation = 0          // Visual facing direction (smoothed)
    this.moveAngle = 0         // Actual movement direction from joystick
    this.turnSmoothing = 0.08  // How smoothly the sphere rotates visually
    this.moveSpeed = 0.025     // Constant forward speed
    this.isMoving = false

    // Floating hover
    this.baseHeight = 0.6
    this.floatAmplitude = 0.1
    this.floatSpeed = 1.5

    // Trail
    this.trailLength = 120
    this.trailPositions = []
    this.trailUpdateTimer = 0
    this.trailUpdateInterval = 16  // ms between trail samples

    this.createPlayerMesh()
    this.createTrail()
  }

  createPlayerMesh() {
    this.group = new THREE.Group()

    const geometry = new THREE.SphereGeometry(0.2, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    })
    this.sphere = new THREE.Mesh(geometry, material)
    this.group.add(this.sphere)

    const glowGeometry = new THREE.SphereGeometry(0.35, 16, 16)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    })
    this.glow = new THREE.Mesh(glowGeometry, glowMaterial)
    this.group.add(this.glow)

    this.light = new THREE.PointLight(0xffffff, 1.5, 8)
    this.light.position.y = 0.2
    this.group.add(this.light)

    this.group.position.copy(this.position)
    this.scene.add(this.group)
  }

  createTrail() {
    for (let i = 0; i < this.trailLength; i++) {
      this.trailPositions.push(this.position.clone())
    }

    const positions = new Float32Array(this.trailLength * 3)
    const colors = new Float32Array(this.trailLength * 3)

    for (let i = 0; i < this.trailLength; i++) {
      positions[i * 3] = this.position.x
      positions[i * 3 + 1] = this.position.y
      positions[i * 3 + 2] = this.position.z

      const alpha = 1 - (i / this.trailLength)
      colors[i * 3] = alpha
      colors[i * 3 + 1] = alpha
      colors[i * 3 + 2] = alpha
    }

    this.trailGeometry = new THREE.BufferGeometry()
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5
    })

    this.trail = new THREE.Line(this.trailGeometry, trailMaterial)
    this.scene.add(this.trail)
  }

  // Called by Navigation: move in this exact direction
  setDirection(angle) {
    this.moveAngle = angle
    this.isMoving = true
  }

  stopMoving() {
    this.isMoving = false
  }

  update() {
    if (this.isMoving) {
      // Move directly in the joystick direction
      this.position.x += Math.sin(this.moveAngle) * this.moveSpeed
      this.position.z += -Math.cos(this.moveAngle) * this.moveSpeed

      // Smoothly rotate the visual to face movement direction
      let angleDiff = this.moveAngle - this.rotation
      angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      this.rotation += angleDiff * this.turnSmoothing
    }

    // Floating hover
    const time = Date.now() * 0.001 * this.floatSpeed
    this.position.y = this.baseHeight + Math.sin(time) * this.floatAmplitude

    // Update mesh
    this.group.position.copy(this.position)
    this.group.rotation.y = this.rotation

    // Glow pulse
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.1
    this.glow.scale.setScalar(pulse)

    // Update trail
    const now = Date.now()
    if (now - this.trailUpdateTimer > this.trailUpdateInterval) {
      this.trailUpdateTimer = now

      for (let i = this.trailLength - 1; i > 0; i--) {
        this.trailPositions[i].copy(this.trailPositions[i - 1])
      }
      this.trailPositions[0].copy(this.position)

      const pos = this.trailGeometry.attributes.position.array
      for (let i = 0; i < this.trailLength; i++) {
        pos[i * 3] = this.trailPositions[i].x
        pos[i * 3 + 1] = this.trailPositions[i].y
        pos[i * 3 + 2] = this.trailPositions[i].z
      }
      this.trailGeometry.attributes.position.needsUpdate = true
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.scene.remove(this.trail)
    this.sphere.geometry.dispose()
    this.sphere.material.dispose()
    this.glow.geometry.dispose()
    this.glow.material.dispose()
    this.trailGeometry.dispose()
    this.trail.material.dispose()
  }
}
