import * as THREE from 'three'
import Experience from './Experience.js'

export default class Navigation {
  constructor() {
    this.experience = new Experience()
    this.camera = this.experience.camera
    this.time = this.experience.time
    this.debug = this.experience.debug

    // Enable/disable navigation
    this.enabled = true

    // Starting position - center of equilateral triangle
    this.startPosition = new THREE.Vector3(0, 1.6, 0)
    this.position = this.startPosition.clone()

    // Distance from center to each vertex
    this.targetDistance = 60

    // Target positions - equilateral triangle vertices (120° apart)
    // Tree at front (0°), Cube at back-left (120°), Sphere at back-right (-120°)
    this.targets = {
      front: { 
        position: new THREE.Vector3(0, 2, -this.targetDistance), 
        angle: 0 
      },
      left: { 
        position: new THREE.Vector3(
          -this.targetDistance * Math.sin(Math.PI * 2 / 3),  // -21.65
          2, 
          -this.targetDistance * Math.cos(Math.PI * 2 / 3)   // 12.5
        ), 
        angle: Math.PI * 2 / 3  // 120 degrees
      },
      right: { 
        position: new THREE.Vector3(
          -this.targetDistance * Math.sin(-Math.PI * 2 / 3), // 21.65
          6,  // Higher to look at center of livestream screen
          -this.targetDistance * Math.cos(-Math.PI * 2 / 3)  // 12.5
        ), 
        angle: -Math.PI * 2 / 3  // -120 degrees
      },
    }
    
    // Current target
    this.currentTarget = 'front'
    this.previousTarget = 'front'
    this.targetRotationY = 0
    this.rotationY = 0
    
    // Flag to prevent auto-target update when key-triggered
    this.isKeyTriggered = false

    // Rotation
    this.rotationVelocity = 0
    this.rotationDamping = 0.85
    this.rotationSensitivity = 0.02  // Higher = less drag needed
    this.snapStrength = 0.04  // How strongly to snap to target (lower = smoother)

    // Mouse state
    this.isDragging = false
    this.previousMouseX = 0
    this.previousMouseY = 0

    // Mouse look - subtle view movement following cursor
    this.mouseLookStrength = 0.2  // How much the view follows the mouse
    this.mouseX = 0  // -1 to 1 (left to right)
    this.mouseY = 0  // -1 to 1 (top to bottom)
    this.currentMouseX = 0  // Smoothed value
    this.currentMouseY = 0  // Smoothed value
    this.mouseLookSmoothing = 0.05  // How smooth the follow is
    
    // Scene drag look - subtle drag interaction in scenes
    this.sceneDragOffsetX = 0
    this.sceneDragOffsetY = 0
    this.sceneDragStrength = 0.3  // How much drag affects the view
    
    // Focus mode drag for orbiting around tree
    this.focusDragDeltaX = 0
    this.sceneDragMax = 0.4  // Maximum drag offset (radians)
    this.sceneDragReturnSpeed = 0.08  // How fast it returns to center

    // Movement with smooth damping
    this.moveVelocity = 0
    this.moveDamping = 0.95
    this.moveSpeed = 0.02

    // Position approach - move toward target on view change
    this.targetPosition = this.startPosition.clone()
    this.approachDistance = 12  // Point A: entry distance when switching to scene
    this.positionLerpSpeed = 0.015  // How fast to approach (lower = smoother)
    this.minDistanceToTarget = 8  // Point B: closest you can get to the target object
    this.minDistanceLivestream = 14  // Special min distance for livestream scene (screen fills viewport)
    this.exitDistance = 20  // Point C: furthest back - triggers exit confirmation
    
    // Exit confirmation state
    this.isAtExitPoint = false
    this.exitConfirmationShown = false

    // Scroll settings for tree focus mode
    this.scrollProgress = 0.85  // Start at exhibition section (top view)
    this.scrollSensitivity = 0.0003
    this.targetScrollProgress = 0.85  // Start at exhibition section

    // Transition to tree when close enough
    this.transitionDistance = 12
    
    // Exhibition orbit mode (free orbit around tree crown)
    this.inExhibitionOrbit = false
    this.exhibitionOrbitSensitivity = 0.005
    this.exhibitionZoomSensitivity = 0.01
    this.exhibitionVerticalSensitivity = 0.01
    
    // Showcase orbit mode (free orbit around tree roots)
    this.inShowcaseOrbit = false

    this.setEventListeners()
    this.setupExitConfirmation()
    this.setupTopBarCenter()
    
    if (this.debug.active) this.setDebug()
  }

  setupTopBarCenter() {
    this.centerContents = document.querySelectorAll('.center-content')
    this.currentTopBarScene = 'default'  // Track current top bar state
    
    // Bottom hint elements
    this.forestHint = document.getElementById('forest-hint')
    this.sceneHint = document.getElementById('scene-hint')
    
    // Scene welcome popup
    this.sceneWelcome = document.getElementById('scene-welcome')
    this.sceneWelcomeTitle = document.getElementById('scene-welcome-title')
    this.sceneWelcomeDescription = document.getElementById('scene-welcome-description')
    this.sceneWelcomeClose = document.getElementById('scene-welcome-close')
    this.sceneWelcomeEnter = document.getElementById('scene-welcome-enter')
    this.welcomeShown = false  // Block scrolling while popup is shown
    this.pendingWelcome = false  // True when switched to scene, waiting to show welcome on scroll
    
    // Scene content
    this.sceneContent = {
      left: {
        title: 'Welcome to Panel Talk Stage',
        description: 'Join us for insightful discussions with industry experts, artists, and thought leaders. Explore the intersection of nature, technology, and creativity through engaging panel sessions.'
      },
      right: {
        title: 'Welcome to Livestream Stage',
        description: 'Experience live performances and real-time broadcasts from artists around the world. Immerse yourself in the energy of live music, visual art, and interactive experiences.'
      }
    }
    
    // Close button listeners
    if (this.sceneWelcomeClose) {
      this.sceneWelcomeClose.addEventListener('click', () => this.closeSceneWelcome())
    }
    if (this.sceneWelcomeEnter) {
      this.sceneWelcomeEnter.addEventListener('click', () => this.closeSceneWelcome())
    }
  }
  
  showSceneWelcome(scene) {
    if (!this.sceneWelcome || !this.sceneContent[scene]) return
    if (!this.pendingWelcome) return  // Only show if pending from scene switch
    
    const content = this.sceneContent[scene]
    this.sceneWelcomeTitle.textContent = content.title
    this.sceneWelcomeDescription.textContent = content.description
    
    this.sceneWelcome.classList.add('is-visible')
    this.welcomeShown = true
    this.pendingWelcome = false  // Clear pending flag after showing
  }
  
  closeSceneWelcome() {
    if (!this.sceneWelcome) return
    
    this.sceneWelcome.classList.remove('is-visible')
    this.welcomeShown = false
    
    // Notify world that we've entered the scene (for video playback etc.)
    if (this.experience.world && this.experience.world.onEnterScene) {
      this.experience.world.onEnterScene(this.currentTarget)
    }
  }
  
  setExhibitionOrbitMode(enabled) {
    this.inExhibitionOrbit = enabled
  }
  
  setShowcaseOrbitMode(enabled) {
    this.inShowcaseOrbit = enabled
  }

  updateTopBarCenter(scene) {
    if (!this.centerContents) return
    
    this.centerContents.forEach(content => {
      const contentScene = content.dataset.scene
      if (contentScene === scene || (scene === 'forest' && contentScene === 'default')) {
        content.classList.add('is-active')
      } else if (contentScene === 'default' && scene === 'default') {
        content.classList.add('is-active')
      } else {
        content.classList.remove('is-active')
      }
    })
  }

  showForestHint() {
    if (this.forestHint) {
      this.forestHint.classList.remove('is-hidden')
    }
    if (this.sceneHint) {
      this.sceneHint.classList.remove('is-visible')
    }
  }

  showSceneHint() {
    if (this.forestHint) {
      this.forestHint.classList.add('is-hidden')
    }
    if (this.sceneHint) {
      this.sceneHint.classList.add('is-visible')
    }
  }

  setupExitConfirmation() {
    this.exitConfirmation = document.querySelector('.exit-confirmation')
    this.exitBtnYes = document.querySelector('.exit-btn-yes')
    this.exitBtnNo = document.querySelector('.exit-btn-no')

    if (this.exitBtnYes) {
      this.exitBtnYes.addEventListener('click', () => this.onExitConfirm())
    }
    if (this.exitBtnNo) {
      this.exitBtnNo.addEventListener('click', () => this.onExitCancel())
    }
  }

  showExitConfirmation() {
    if (this.exitConfirmation && !this.exitConfirmationShown) {
      this.exitConfirmation.classList.add('is-visible')
      this.exitConfirmationShown = true
      this.isAtExitPoint = true
    }
  }

  hideExitConfirmation() {
    if (this.exitConfirmation) {
      this.exitConfirmation.classList.remove('is-visible')
      this.exitConfirmationShown = false
    }
  }

  onExitConfirm() {
    // User chose to exit - go back to forest center
    this.hideExitConfirmation()
    this.isAtExitPoint = false
    
    // Notify world that we're exiting the scene
    if (this.experience.world && this.experience.world.onExitScene) {
      this.experience.world.onExitScene(this.currentTarget)
    }
    
    // Reset to start position and look at front (tree)
    this.previousTarget = this.currentTarget
    this.currentTarget = 'front'
    this.targetRotationY = this.targets.front.angle
    
    // Update top bar center text and hints
    this.currentTopBarScene = 'default'
    this.updateTopBarCenter('default')
    this.showForestHint()
    
    // Adjust target rotation for shortest path
    let angleDiff = this.targetRotationY - this.rotationY
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    this.targetRotationY = this.rotationY + angleDiff
    
    // Move back to start position
    this.targetPosition.copy(this.startPosition)
    this.isKeyTriggered = true
  }

  onExitCancel() {
    // User chose to stay - move back to entry point (Point A)
    this.hideExitConfirmation()
    this.isAtExitPoint = false
    
    // Calculate entry point (approach distance from start toward current target)
    const currentTargetObj = this.targets[this.currentTarget]
    const directionToTarget = new THREE.Vector3()
    directionToTarget.subVectors(currentTargetObj.position, this.startPosition).normalize()
    
    this.targetPosition = this.startPosition.clone().add(
      directionToTarget.multiplyScalar(this.approachDistance)
    )
    this.targetPosition.y = 1.6
  }

  setDebug() {
    const folder = this.debug.ui.addFolder('Navigation')
    
    // Movement settings
    folder.add(this, 'moveSpeed').min(0.01).max(1).step(0.01).name('Scroll Speed')
    folder.add(this, 'moveDamping').min(0.8).max(0.99).step(0.01).name('Move Damping')
    
    // Rotation settings
    folder.add(this, 'rotationSensitivity').min(0.005).max(0.1).step(0.005).name('Drag Sensitivity')
    folder.add(this, 'rotationDamping').min(0.5).max(0.95).step(0.01).name('Rotation Damping')
    folder.add(this, 'snapStrength').min(0.01).max(0.3).step(0.01).name('Snap Strength')
    
    // Approach settings
    folder.add(this, 'approachDistance').min(0).max(30).step(1).name('Point A (Entry)')
    folder.add(this, 'minDistanceToTarget').min(3).max(20).step(1).name('Point B (Closest)')
    folder.add(this, 'minDistanceLivestream').min(5).max(25).step(1).name('Livestream Min Dist')
    folder.add(this, 'exitDistance').min(10).max(40).step(1).name('Point C (Exit)')
    folder.add(this, 'positionLerpSpeed').min(0.01).max(0.1).step(0.01).name('Approach Speed')
    
    // Mouse look
    folder.add(this, 'mouseLookStrength').min(0).max(2).step(0.05).name('Mouse Look Strength')
    
    // Scene drag look
    folder.add(this, 'sceneDragStrength').min(0).max(1).step(0.05).name('Scene Drag Strength')
    folder.add(this, 'sceneDragMax').min(0.1).max(1).step(0.05).name('Scene Drag Max')
    folder.add(this, 'sceneDragReturnSpeed').min(0.01).max(0.2).step(0.01).name('Scene Drag Return')
  }

  setEventListeners() {
    window.addEventListener('mousedown', (e) => this.onMouseDown(e))
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    window.addEventListener('mouseup', (e) => this.onMouseUp(e))
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    window.addEventListener('keyup', (e) => this.onKeyUp(e))

    // Touch support
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false })
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false })
    window.addEventListener('touchend', (e) => this.onTouchEnd(e))

    // Clickable arrow keys in UI
    const keyLeft = document.getElementById('key-left')
    const keyRight = document.getElementById('key-right')
    
    if (keyLeft) {
      keyLeft.addEventListener('click', () => {
        if (this.enabled && this.experience.phase === 'forest' && this.isNearForestCenter()) {
          this.switchToNextTarget('left')
        }
      })
    }
    
    if (keyRight) {
      keyRight.addEventListener('click', () => {
        if (this.enabled && this.experience.phase === 'forest' && this.isNearForestCenter()) {
          this.switchToNextTarget('right')
        }
      })
    }
  }

  onMouseDown(event) {
    if (event.button === 0) {
      this.isDragging = true
      this.isKeyTriggered = false  // Allow drag to override key-triggered target
      this.previousMouseX = event.clientX
      this.previousMouseY = event.clientY
      document.body.style.cursor = 'grabbing'
    }
  }

  // Check if near the forest center (start position)
  isNearForestCenter() {
    const distanceFromStart = this.position.distanceTo(this.startPosition)
    // Within or at the approach distance - allows drag scene switching when not deep in a scene
    return distanceFromStart <= this.approachDistance + 1
  }

  onMouseMove(event) {
    // Always track mouse position for look-around effect
    // Convert to -1 to 1 range (center = 0)
    this.mouseX = (event.clientX / window.innerWidth) * 2 - 1
    this.mouseY = (event.clientY / window.innerHeight) * 2 - 1

    // Handle dragging for rotation
    if (!this.isDragging) return
    if (this.exitConfirmationShown) return  // Block rotation when exit confirmation is shown

    const deltaX = event.clientX - this.previousMouseX
    const deltaY = event.clientY - this.previousMouseY
    
    if (this.inExhibitionOrbit) {
      // Exhibition orbit mode - free orbit around tree crown
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateExhibitionOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.inShowcaseOrbit) {
      // Showcase orbit mode - free orbit around tree roots
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateShowcaseOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.experience.phase === 'tree') {
      // In tree/focus mode - drag to orbit around the tree
      this.focusDragDeltaX = deltaX
    } else if (this.experience.phase === 'forest' && this.isNearForestCenter()) {
      // Full rotation when near forest center
      let velocity = deltaX * this.rotationSensitivity  // Inverted: drag right to look left
      
      // Limit drag direction based on current target
      if (this.currentTarget === 'left' && velocity > 0) {
        velocity = 0  // Block dragging further left (toward edge)
      } else if (this.currentTarget === 'right' && velocity < 0) {
        velocity = 0  // Block dragging further right (toward edge)
      }
      
      this.rotationVelocity = velocity
    } else {
      // Subtle drag look when in a scene (not near forest center)
      this.sceneDragOffsetX += deltaX * this.sceneDragStrength * 0.01
      this.sceneDragOffsetY += deltaY * this.sceneDragStrength * 0.01
      
      // Clamp to max offset
      this.sceneDragOffsetX = THREE.MathUtils.clamp(this.sceneDragOffsetX, -this.sceneDragMax, this.sceneDragMax)
      this.sceneDragOffsetY = THREE.MathUtils.clamp(this.sceneDragOffsetY, -this.sceneDragMax, this.sceneDragMax)
    }
    
    this.previousMouseX = event.clientX
    this.previousMouseY = event.clientY
  }

  onMouseUp(event) {
    if (event.button === 0) {
      this.isDragging = false
      document.body.style.cursor = 'grab'
    }
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      this.isDragging = true
      this.previousMouseX = event.touches[0].clientX
      this.previousMouseY = event.touches[0].clientY
    }
  }

  onTouchMove(event) {
    if (!this.isDragging || event.touches.length !== 1) return
    if (this.exitConfirmationShown) return  // Block rotation when exit confirmation is shown

    const deltaX = event.touches[0].clientX - this.previousMouseX
    const deltaY = event.touches[0].clientY - this.previousMouseY
    
    if (this.inExhibitionOrbit) {
      // Exhibition orbit mode - free orbit around tree crown
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateExhibitionOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.inShowcaseOrbit) {
      // Showcase orbit mode - free orbit around tree roots
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateShowcaseOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.experience.phase === 'forest' && this.isNearForestCenter()) {
      // Full rotation when near forest center
      let velocity = deltaX * this.rotationSensitivity  // Inverted: drag right to look left
      
      // Limit drag direction based on current target (same as mouse)
      if (this.currentTarget === 'left' && velocity > 0) {
        velocity = 0  // Block dragging further left (toward edge)
      } else if (this.currentTarget === 'right' && velocity < 0) {
        velocity = 0  // Block dragging further right (toward edge)
      }
      
      this.rotationVelocity = velocity
    } else {
      // Subtle drag look when in a scene (not near forest center)
      this.sceneDragOffsetX += deltaX * this.sceneDragStrength * 0.01
      this.sceneDragOffsetY += deltaY * this.sceneDragStrength * 0.01
      
      // Clamp to max offset
      this.sceneDragOffsetX = THREE.MathUtils.clamp(this.sceneDragOffsetX, -this.sceneDragMax, this.sceneDragMax)
      this.sceneDragOffsetY = THREE.MathUtils.clamp(this.sceneDragOffsetY, -this.sceneDragMax, this.sceneDragMax)
    }
    
    this.previousMouseX = event.touches[0].clientX
    this.previousMouseY = event.touches[0].clientY
  }

  onTouchEnd(event) {
    this.isDragging = false
  }

  onWheel(event) {
    event.preventDefault()

    if (this.inExhibitionOrbit) {
      // Exhibition orbit mode - scroll to zoom in/out
      const deltaRadius = event.deltaY * this.exhibitionZoomSensitivity
      this.camera.updateExhibitionOrbit(0, deltaRadius, 0)
    } else if (this.inShowcaseOrbit) {
      // Showcase orbit mode - scroll to zoom in/out
      const deltaRadius = event.deltaY * this.exhibitionZoomSensitivity
      this.camera.updateShowcaseOrbit(0, deltaRadius, 0)
    } else if (this.experience.phase === 'forest') {
      // Allow scrolling for all targets (tree, cube, sphere)
      const scrollDelta = Math.sign(event.deltaY) * this.moveSpeed
      this.moveVelocity += scrollDelta

    } else if (this.experience.phase === 'tree') {
      this.targetScrollProgress -= event.deltaY * this.scrollSensitivity
      this.targetScrollProgress = THREE.MathUtils.clamp(this.targetScrollProgress, 0, 1)
    }
  }

  onKeyDown(event) {
    // Block navigation when exit confirmation is shown
    if (this.exitConfirmationShown) return
    
    // Left/Right arrow keys to switch between targets (only when near forest center)
    if (this.experience.phase === 'forest' && this.isNearForestCenter()) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        this.switchToNextTarget('left')
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        this.switchToNextTarget('right')
      }
    }
    
    // Escape to exit tree mode
    if (event.code === 'Escape' && this.experience.phase === 'tree') {
      this.experience.transitionToForest()
    }
  }

  onKeyUp(event) {
    // Currently not needed, but here for future use
  }

  // Switch to the next target in the given direction
  switchToNextTarget(direction) {
    // Order: left <- front -> right
    const targetOrder = ['left', 'front', 'right']
    const currentIndex = targetOrder.indexOf(this.currentTarget)
    
    let newIndex
    if (direction === 'left') {
      newIndex = currentIndex - 1
      if (newIndex < 0) newIndex = 0  // Stay at leftmost
    } else {
      newIndex = currentIndex + 1
      if (newIndex > 2) newIndex = 2  // Stay at rightmost
    }
    
    const newTarget = targetOrder[newIndex]
    
    if (newTarget !== this.currentTarget) {
      this.previousTarget = this.currentTarget
      this.currentTarget = newTarget
      this.targetRotationY = this.targets[newTarget].angle
      this.isKeyTriggered = true  // Prevent auto-target from overriding
      
      // Update bottom hints based on target direction
      if (newTarget === 'left' || newTarget === 'right') {
        this.showSceneHint()
        this.pendingWelcome = true  // Mark that we should show welcome when entering
      } else {
        this.showForestHint()
        this.pendingWelcome = false
      }
      
      // Calculate position approaching the new target
      const targetObj = this.targets[this.currentTarget]
      const directionToTarget = new THREE.Vector3()
      directionToTarget.subVectors(targetObj.position, this.startPosition).normalize()
      
      // Set target position partway toward the object
      this.targetPosition = this.startPosition.clone().add(
        directionToTarget.multiplyScalar(this.approachDistance)
      )
      this.targetPosition.y = 1.6
    }
  }

  // Calculate shortest angular distance (accounting for wrap-around)
  getAngularDistance(angle1, angle2) {
    let diff = angle1 - angle2
    // Normalize to -PI to PI
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    return Math.abs(diff)
  }

  // Determine which target to snap to based on current rotation
  updateCurrentTarget() {
    // Normalize rotation to -PI to PI range
    let normalizedRotation = this.rotationY % (Math.PI * 2)
    if (normalizedRotation > Math.PI) normalizedRotation -= Math.PI * 2
    if (normalizedRotation < -Math.PI) normalizedRotation += Math.PI * 2

    // Determine closest target based on angle (using proper angular distance)
    const frontDist = this.getAngularDistance(normalizedRotation, this.targets.front.angle)
    const leftDist = this.getAngularDistance(normalizedRotation, this.targets.left.angle)
    const rightDist = this.getAngularDistance(normalizedRotation, this.targets.right.angle)

    // Find minimum distance
    const minDist = Math.min(frontDist, leftDist, rightDist)

    let newTarget = 'front'
    let newTargetAngle = this.targets.front.angle
    
    if (minDist === frontDist) {
      newTarget = 'front'
      newTargetAngle = this.targets.front.angle
    } else if (minDist === leftDist) {
      newTarget = 'left'
      newTargetAngle = this.targets.left.angle
    } else {
      newTarget = 'right'
      newTargetAngle = this.targets.right.angle
    }
    
    // Adjust target angle to take shortest path from current rotation
    let angleDiff = newTargetAngle - this.rotationY
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    this.targetRotationY = this.rotationY + angleDiff

    // If target changed, update target position to approach
    if (newTarget !== this.currentTarget) {
      this.previousTarget = this.currentTarget
      this.currentTarget = newTarget
      
      // Update bottom hints based on target direction
      if (newTarget === 'left' || newTarget === 'right') {
        this.showSceneHint()
        this.pendingWelcome = true  // Mark that we should show welcome when entering
      } else {
        this.showForestHint()
        this.pendingWelcome = false
      }
      
      // Calculate position approaching the new target
      const targetObj = this.targets[this.currentTarget]
      const directionToTarget = new THREE.Vector3()
      directionToTarget.subVectors(targetObj.position, this.startPosition).normalize()
      
      // Set target position partway toward the object
      this.targetPosition = this.startPosition.clone().add(
        directionToTarget.multiplyScalar(this.approachDistance)
      )
      this.targetPosition.y = 1.6
    }
  }

  update() {
    if (!this.enabled) return
    
    if (this.experience.phase === 'forest') {
      this.updateWalkMode()
    } else if (this.experience.phase === 'tree') {
      this.updateFocusMode()
    }
  }

  updateWalkMode() {
    // Apply rotation velocity from dragging
    this.rotationY += this.rotationVelocity
    
    // Apply damping when not dragging
    if (!this.isDragging) {
      this.rotationVelocity *= this.rotationDamping
      
      // Only auto-determine target if not key-triggered
      if (!this.isKeyTriggered) {
        this.updateCurrentTarget()
      }
      
      // Snap toward target rotation when not dragging
      this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, this.snapStrength)
      
      // Check if rotation is close to target, then allow auto-targeting again
      if (this.isKeyTriggered && Math.abs(this.rotationY - this.targetRotationY) < 0.05) {
        this.isKeyTriggered = false
      }
      
      // Smoothly move position toward target position (approach effect)
      this.position.lerp(this.targetPosition, this.positionLerpSpeed)
    }

    // Handle scroll movement toward current target direction
    // Block movement when exit confirmation or welcome popup is shown
    if (Math.abs(this.moveVelocity) > 0.001 && !this.exitConfirmationShown && !this.welcomeShown) {
      const currentTargetObj = this.targets[this.currentTarget]
      const forward = new THREE.Vector3()
      forward.subVectors(currentTargetObj.position, this.startPosition).normalize()
      
      // Calculate new position
      const newPosition = this.position.clone().add(forward.clone().multiplyScalar(this.moveVelocity))
      
      // Calculate distance from start along the target direction
      const toNewPos = new THREE.Vector3().subVectors(newPosition, this.startPosition)
      const distanceFromStart = toNewPos.dot(forward)  // Project onto forward direction
      
      // Calculate distance to target object
      const targetPos2D = new THREE.Vector3(currentTargetObj.position.x, 1.6, currentTargetObj.position.z)
      const distanceToTarget = newPosition.distanceTo(targetPos2D)
      
      // For cube/sphere scenes (Panel Talk / Livestream)
      if (this.currentTarget !== 'front') {
        // Check if entering the scene (after switching via drag/arrow)
        const entryThreshold = this.approachDistance + 2
        const newDistanceFromStart = newPosition.distanceTo(this.startPosition)
        
        // Show welcome when moving forward past entry threshold after scene switch
        if (newDistanceFromStart > entryThreshold && this.pendingWelcome && this.moveVelocity > 0) {
          // Entering the scene - show welcome popup
          this.position.copy(newPosition)
          this.targetPosition.copy(newPosition)
          this.moveVelocity = 0
          this.showSceneWelcome(this.currentTarget)
          return  // Stop processing movement this frame
        }
        
        // Going backward past exit distance triggers confirmation
        if (distanceFromStart < -this.exitDistance) {
          // Clamp to exit point and show confirmation
          const exitPosition = this.startPosition.clone().add(
            forward.clone().multiplyScalar(-this.exitDistance)
          )
          exitPosition.y = 1.6
          this.position.copy(exitPosition)
          this.targetPosition.copy(exitPosition)
          this.moveVelocity = 0
          this.showExitConfirmation()
        } else if (distanceFromStart >= 0) {
          // Moving forward within allowed range (Point A to Point B)
          // Use scene-specific min distance for livestream
          const minDist = this.currentTarget === 'right' ? this.minDistanceLivestream : this.minDistanceToTarget
          if (distanceToTarget >= minDist) {
            this.position.copy(newPosition)
          }
        } else if (distanceFromStart < 0 && distanceFromStart >= -this.exitDistance) {
          // Moving backward between Point A and Point C
          this.position.copy(newPosition)
        }
      } else {
        // Front (tree) scene - allow getting close enough to trigger transition
        // Use a smaller min distance for tree to allow transition
        const treeMinDistance = this.transitionDistance - 2  // Allow getting close enough to trigger
        if (distanceFromStart >= 0 && distanceToTarget >= treeMinDistance) {
          this.position.copy(newPosition)
        } else if (distanceFromStart < 0 && distanceFromStart >= -this.approachDistance * 0.5) {
          this.position.copy(newPosition)
        }
      }
      
      this.moveVelocity *= this.moveDamping
      
      // Update target position to current position (so it doesn't snap back)
      this.targetPosition.copy(this.position)
    } else if (this.exitConfirmationShown || this.welcomeShown) {
      // Stop all movement when confirmation or welcome is shown
      this.moveVelocity = 0
    }

    // Keep at eye height
    this.position.y = 1.6
    this.targetPosition.y = 1.6

    // Update top bar based on position (only change when actually deep in a scene)
    const distanceFromCenter = this.position.distanceTo(this.startPosition)
    const inSceneThreshold = this.approachDistance + 2  // Past the approach point
    
    if (distanceFromCenter > inSceneThreshold && this.currentTarget !== 'front') {
      // Deep in a left/right scene (Panel Talk or Livestream)
      if (this.currentTopBarScene !== this.currentTarget) {
        this.currentTopBarScene = this.currentTarget
        this.updateTopBarCenter(this.currentTarget)
      }
    } else if (distanceFromCenter <= inSceneThreshold) {
      // Near forest center - show countdown
      if (this.currentTopBarScene !== 'default') {
        this.currentTopBarScene = 'default'
        this.updateTopBarCenter('default')
      }
    }

    // Smooth mouse look values
    this.currentMouseX = THREE.MathUtils.lerp(this.currentMouseX, this.mouseX, this.mouseLookSmoothing)
    this.currentMouseY = THREE.MathUtils.lerp(this.currentMouseY, this.mouseY, this.mouseLookSmoothing)

    // Return scene drag offset to center when not dragging
    if (!this.isDragging) {
      this.sceneDragOffsetX = THREE.MathUtils.lerp(this.sceneDragOffsetX, 0, this.sceneDragReturnSpeed)
      this.sceneDragOffsetY = THREE.MathUtils.lerp(this.sceneDragOffsetY, 0, this.sceneDragReturnSpeed)
    }

    // Calculate total look offset (mouse look + scene drag)
    const mouseLookOffsetX = this.currentMouseX * this.mouseLookStrength + this.sceneDragOffsetX
    const mouseLookOffsetY = -this.currentMouseY * this.mouseLookStrength + this.sceneDragOffsetY  // Invert Y

    // Get current target position for look-at (keeps object centered)
    const currentTargetObj = this.targets[this.currentTarget]
    const lookAtTarget = new THREE.Vector3(
      currentTargetObj.position.x,
      currentTargetObj.position.y,
      currentTargetObj.position.z
    )

    // Update camera with mouse look and look-at target
    this.camera.updateWalkPosition(this.position, this.rotationY, mouseLookOffsetX, mouseLookOffsetY, lookAtTarget)

    // Check distance to tree for transition (only when facing tree)
    if (this.currentTarget === 'front') {
      const treePos = new THREE.Vector3(0, this.position.y, -this.targetDistance)
      const distToTree = this.position.distanceTo(treePos)
      if (distToTree < this.transitionDistance) {
        this.experience.transitionToTree()
      }
    }
  }

  updateFocusMode() {
    this.scrollProgress = THREE.MathUtils.lerp(
      this.scrollProgress,
      this.targetScrollProgress,
      0.08
    )

    this.camera.updateScrollProgress(this.scrollProgress)

    if (this.experience.sections) {
      this.experience.sections.updateScroll(this.scrollProgress)
    }
    
    // Handle orbit dragging in focus mode
    if (this.isDragging && this.focusDragDeltaX !== 0) {
      this.camera.updateFocusOrbit(this.focusDragDeltaX * 0.005)
      this.focusDragDeltaX = 0
    }
  }

  resetToStart() {
    this.position.copy(this.startPosition)
    this.targetPosition.copy(this.startPosition)
    this.rotationY = 0
    this.targetRotationY = 0
    this.rotationVelocity = 0
    this.moveVelocity = 0
    this.currentTarget = 'front'
    this.previousTarget = 'front'
    this.isKeyTriggered = false
    
    // Reset top bar and hints to default
    this.currentTopBarScene = 'default'
    this.updateTopBarCenter('default')
    this.showForestHint()
  }

  dispose() {
    // Event listeners will be garbage collected with the page
  }
}
