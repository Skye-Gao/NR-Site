import * as THREE from 'three'
import Experience from './Experience.js'

export default class Camera {
  constructor() {
    this.experience = new Experience()
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene

    // Camera modes: 'landing' for overhead view, 'walk' for forest exploration, 'focus' for tree view, 'exhibitionOrbit' for free orbit in exhibition
    this.mode = 'landing'

    // Landing mode settings - overhead view
    this.landingPosition = new THREE.Vector3(0, 45, 30)
    this.landingLookAt = new THREE.Vector3(0, 0, -20)
    this.landingRotation = 0 // Slow rotation angle

    // Walk mode settings
    this.walkPosition = new THREE.Vector3(0, 1.6, 0)
    this.walkRotationY = 0 // Yaw angle (horizontal rotation)
    this.walkLookAtTarget = null // Target position to look at (keeps object centered)

    // Mouse look offset (subtle movement following cursor)
    this.mouseLookX = 0
    this.mouseLookY = 0

    // Focus mode settings - tree is at z = -60
    this.treePosition = new THREE.Vector3(0, 0, -60)
    this.focusOrbitRadius = 8
    this.focusMinOrbitRadius = 12  // Close when at bottom (showcase - underground)
    this.focusMaxOrbitRadius = 22  // Far when at top (exhibition)
    this.focusHeight = 5
    this.focusMinHeight = -8       // Bottom section height (underground for roots)
    this.focusMaxHeight = 16       // Top section - at crown level for horizontal view
    this.focusLookAtHeight = 5     // Where camera looks at
    this.focusLookAtRatio = 0.95   // At top, look nearly at same height (horizontal)
    this.focusMinLookAtHeight = -10 // Look at roots when at bottom
    this.scrollProgress = 0.5     // Start at tree landing position (middle)
    
    // Focus mode orbit angle (for panning around tree)
    this.focusOrbitAngle = Math.PI * 0.5  // Start from side
    this.targetFocusOrbitAngle = Math.PI * 0.5
    this.focusOrbitSpeed = 0.003
    
    // Exhibition Orbit mode settings (free orbit around tree crown)
    this.exhibitionOrbitAngle = Math.PI * 0.5
    this.exhibitionOrbitRadius = 18
    this.exhibitionOrbitHeight = 16
    this.exhibitionOrbitMinRadius = 8
    this.exhibitionOrbitMaxRadius = 30
    this.exhibitionOrbitMinHeight = 10
    this.exhibitionOrbitMaxHeight = 25
    this.exhibitionLookAtHeight = 14  // Look at crown level
    
    // Showcase Orbit mode settings (free orbit underground around roots)
    this.showcaseOrbitAngle = Math.PI * 0.5
    this.showcaseOrbitRadius = 14
    this.showcaseOrbitHeight = -8       // Underground
    this.showcaseOrbitMinRadius = 8
    this.showcaseOrbitMaxRadius = 25
    this.showcaseOrbitMinHeight = -20   // Deep underground
    this.showcaseOrbitMaxHeight = -2    // Near surface
    this.showcaseLookAtHeight = -10     // Look at center of root system
    
    // Debug reference
    this.debug = this.experience.debug

    this.setInstance()
    this.setupDebug()
  }

  setupDebug() {
    if (!this.debug?.ui) return
    
    const folder = this.debug.ui.addFolder('Tree View Camera')
    folder.close()
    
    folder.add(this, 'focusMinHeight').min(0).max(15).step(0.5).name('Min Height (Showcase)')
    folder.add(this, 'focusMaxHeight').min(15).max(50).step(1).name('Max Height (Exhibition)')
    folder.add(this, 'focusMinOrbitRadius').min(3).max(20).step(0.5).name('Min Distance')
    folder.add(this, 'focusMaxOrbitRadius').min(10).max(50).step(1).name('Max Distance')
    folder.add(this, 'focusLookAtRatio').min(0.2).max(0.9).step(0.05).name('Look At Ratio')
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      60, // Wider FOV for immersive feel
      this.sizes.width / this.sizes.height,
      0.1,
      200
    )
    
    // Start with overhead landing view
    this.instance.position.copy(this.landingPosition)
    this.instance.lookAt(this.landingLookAt)
    this.scene.add(this.instance)
  }

  setLandingMode() {
    this.mode = 'landing'
  }

  setWalkMode() {
    this.mode = 'walk'
    // Pre-seed walk state from current camera so the first frame has no jump
    this.walkPosition.copy(this.instance.position)
  }

  setFocusMode() {
    this.mode = 'focus'
  }
  
  setExhibitionOrbitMode() {
    this.mode = 'exhibitionOrbit'
    // Initialize from current focus position
    this.exhibitionOrbitAngle = this.focusOrbitAngle
    this.exhibitionOrbitRadius = this.focusOrbitRadius
    this.exhibitionOrbitHeight = this.focusHeight
  }
  
  setShowcaseOrbitMode() {
    this.mode = 'showcaseOrbit'
    // Initialize from current focus position
    this.showcaseOrbitAngle = this.focusOrbitAngle
    this.showcaseOrbitRadius = this.focusOrbitRadius
    this.showcaseOrbitHeight = this.focusHeight
  }

  updateWalkPosition(position, rotationY, mouseLookX = 0, mouseLookY = 0, lookAtTarget = null) {
    if (this.mode !== 'walk') return
    
    this.walkPosition.copy(position)
    this.walkRotationY = rotationY
    this.mouseLookX = mouseLookX
    this.mouseLookY = mouseLookY
    this.walkLookAtTarget = lookAtTarget
  }

  updateScrollProgress(progress) {
    if (this.mode !== 'focus') return
    
    this.scrollProgress = THREE.MathUtils.clamp(progress, 0, 1)
    
    // Height increases with scroll (bottom = underground, top = crown)
    this.focusHeight = THREE.MathUtils.lerp(
      this.focusMinHeight,
      this.focusMaxHeight,
      this.scrollProgress
    )
    
    // Orbit radius changes with scroll
    this.focusOrbitRadius = THREE.MathUtils.lerp(
      this.focusMinOrbitRadius,
      this.focusMaxOrbitRadius,
      this.scrollProgress
    )
    
    // Look-at height - underground at bottom, crown level at top
    this.focusLookAtHeight = THREE.MathUtils.lerp(
      this.focusMinLookAtHeight,  // Look at roots when underground
      this.focusMaxHeight * this.focusLookAtRatio,  // Look at crown when at top
      this.scrollProgress
    )
  }
  
  updateFocusOrbit(deltaAngle) {
    if (this.mode !== 'focus') return
    this.targetFocusOrbitAngle += deltaAngle
  }
  
  updateExhibitionOrbit(deltaAngle, deltaRadius, deltaHeight) {
    if (this.mode !== 'exhibitionOrbit') return
    
    this.exhibitionOrbitAngle += deltaAngle
    
    this.exhibitionOrbitRadius = THREE.MathUtils.clamp(
      this.exhibitionOrbitRadius + deltaRadius,
      this.exhibitionOrbitMinRadius,
      this.exhibitionOrbitMaxRadius
    )
    
    this.exhibitionOrbitHeight = THREE.MathUtils.clamp(
      this.exhibitionOrbitHeight + deltaHeight,
      this.exhibitionOrbitMinHeight,
      this.exhibitionOrbitMaxHeight
    )
  }
  
  updateShowcaseOrbit(deltaAngle, deltaRadius, deltaHeight) {
    if (this.mode !== 'showcaseOrbit') return
    
    this.showcaseOrbitAngle += deltaAngle
    
    this.showcaseOrbitRadius = THREE.MathUtils.clamp(
      this.showcaseOrbitRadius + deltaRadius,
      this.showcaseOrbitMinRadius,
      this.showcaseOrbitMaxRadius
    )
    
    this.showcaseOrbitHeight = THREE.MathUtils.clamp(
      this.showcaseOrbitHeight + deltaHeight,
      this.showcaseOrbitMinHeight,
      this.showcaseOrbitMaxHeight
    )
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    if (this.mode === 'landing') {
      // Slow rotation for cinematic overhead view
      this.landingRotation += 0.0005
      
      const radius = 40
      const height = 45
      const x = Math.sin(this.landingRotation) * radius
      const z = Math.cos(this.landingRotation) * radius
      
      // Smooth camera position - elevated view looking down at the forest
      const targetPos = new THREE.Vector3(x, height, z)
      this.instance.position.lerp(targetPos, 0.015)
      
      // Look at center of the forest
      this.instance.lookAt(0, 5, -15)
      
    } else if (this.mode === 'walk') {
      // Apply position
      this.instance.position.copy(this.walkPosition)
      
      // If we have a specific target to look at, use it (keeps object centered)
      if (this.walkLookAtTarget) {
        // Apply subtle mouse look offset to the target
        const targetWithOffset = new THREE.Vector3(
          this.walkLookAtTarget.x + this.mouseLookX * 3,
          this.walkLookAtTarget.y + this.mouseLookY * 2,
          this.walkLookAtTarget.z
        )
        this.instance.lookAt(targetWithOffset)
      } else {
        // Calculate look direction with mouse offset (free look)
        const yaw = this.walkRotationY + this.mouseLookX
        const pitch = this.mouseLookY * 0.3  // Subtle vertical look
        
        // Calculate look-at point based on rotation
        const lookDistance = 10
        const lookTarget = new THREE.Vector3(
          this.walkPosition.x - Math.sin(yaw) * lookDistance,
          this.walkPosition.y + pitch * lookDistance,  // Vertical offset
          this.walkPosition.z - Math.cos(yaw) * lookDistance
        )
        
        this.instance.lookAt(lookTarget)
      }
      
    } else if (this.mode === 'focus') {
      // Smoothly interpolate orbit angle
      this.focusOrbitAngle = THREE.MathUtils.lerp(
        this.focusOrbitAngle, 
        this.targetFocusOrbitAngle, 
        0.05
      )
      
      const x = Math.sin(this.focusOrbitAngle) * this.focusOrbitRadius
      const z = this.treePosition.z + Math.cos(this.focusOrbitAngle) * this.focusOrbitRadius
      
      // Camera position - higher and farther at top for overview
      const targetPosition = new THREE.Vector3(x, this.focusHeight, z)
      this.instance.position.lerp(targetPosition, 0.05)
      
      // Look at point - slightly below camera at top to see crowns from above
      this.instance.lookAt(this.treePosition.x, this.focusLookAtHeight, this.treePosition.z)
      
    } else if (this.mode === 'exhibitionOrbit') {
      // Free orbit around the tree crown
      const x = Math.sin(this.exhibitionOrbitAngle) * this.exhibitionOrbitRadius
      const z = this.treePosition.z + Math.cos(this.exhibitionOrbitAngle) * this.exhibitionOrbitRadius
      
      // Smooth position update
      const targetPosition = new THREE.Vector3(x, this.exhibitionOrbitHeight, z)
      this.instance.position.lerp(targetPosition, 0.08)
      
      // Look at tree crown
      this.instance.lookAt(this.treePosition.x, this.exhibitionLookAtHeight, this.treePosition.z)
      
    } else if (this.mode === 'showcaseOrbit') {
      // Free orbit around the tree roots
      const x = Math.sin(this.showcaseOrbitAngle) * this.showcaseOrbitRadius
      const z = this.treePosition.z + Math.cos(this.showcaseOrbitAngle) * this.showcaseOrbitRadius
      
      // Smooth position update
      const targetPosition = new THREE.Vector3(x, this.showcaseOrbitHeight, z)
      this.instance.position.lerp(targetPosition, 0.08)
      
      // Look at tree roots
      this.instance.lookAt(this.treePosition.x, this.showcaseLookAtHeight, this.treePosition.z)
    }
  }

  dispose() {}
}
