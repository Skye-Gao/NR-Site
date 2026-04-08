import * as THREE from 'three'
import gsap from 'gsap'
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
    
    // Scene transition state
    this.isSceneTransitioning = false
    this.sceneTransitionDuration = 3.5
    
    // Drag-to-switch scene
    this.dragAccumulatedX = 0
    this.dragSwitchThreshold = 80  // pixels of horizontal drag to trigger scene switch
    
    // Whether user is currently inside a Panel Talk / Livestream scene (past welcome popup)
    this.inScene = false

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
    this.positionLerpSpeed = 0.008  // How fast to approach (lower = smoother)
    this.minDistanceToTarget = 8  // Point B: closest you can get to the target object
    this.minDistanceLivestream = 14  // Special min distance for livestream scene (screen fills viewport)
    this.exitDistance = 20  // Point C: furthest back - triggers exit confirmation
    
    // Exit confirmation state
    this.isAtExitPoint = false
    this.exitConfirmationShown = false

    // Scroll settings for tree focus mode
    this.scrollProgress = 0.5  // Start at tree landing position (middle)
    this.scrollSensitivity = 0.0003
    this.targetScrollProgress = 0.5  // Start at tree landing position

    // Transition to tree when close enough
    this.transitionDistance = 12
    
    // Exhibition overview popup (shown at halfway in forest)
    this.exhibitionOverviewShown = false
    this.halfwayDistance = this.targetDistance / 2  // Half the distance to tree
    this.treeLandingScrollProgress = 0.5  // Where on the tree the camera lands
    
    // Exhibition orbit mode (free orbit around tree crown)
    this.inExhibitionOrbit = false
    this.exhibitionOrbitSensitivity = 0.005
    this.exhibitionZoomSensitivity = 0.01
    this.exhibitionVerticalSensitivity = 0.01
    
    // Showcase orbit mode (free orbit around tree roots)
    this.inShowcaseOrbit = false

    this.setEventListeners()
    this.setupExitConfirmation()
    this.setupExhibitionOverview()
    this.setupTopBarCenter()
    this.updateNavArrows()
    
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
    
    const content = this.sceneContent[scene]
    this.sceneWelcomeTitle.textContent = content.title
    this.sceneWelcomeDescription.textContent = content.description
    
    this.sceneWelcome.classList.add('is-visible')
    this.welcomeShown = true
  }
  
  closeSceneWelcome() {
    if (!this.sceneWelcome) return
    
    this.sceneWelcome.classList.remove('is-visible')
    this.welcomeShown = false
    this.inScene = true
    
    // Show scene navigation hint
    this.showSceneHintWithName(this.currentTarget)
    
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

  setNavButtonsVisible(visible) {
    if (this.navArrowLeft) {
      this.navArrowLeft.style.opacity = visible ? '' : '0'
      this.navArrowLeft.style.pointerEvents = visible ? '' : 'none'
    }
    if (this.navArrowRight) {
      this.navArrowRight.style.opacity = visible ? '' : '0'
      this.navArrowRight.style.pointerEvents = visible ? '' : 'none'
    }
  }

  showSceneHintWithName(scene) {
    const nameMap = { left: 'Panel Talk', right: 'Livestream' }
    const nameEl = document.getElementById('scene-hint-name')
    if (nameEl && nameMap[scene]) {
      nameEl.textContent = nameMap[scene]
    }
    this.showSceneHint()
  }

  updateNavArrows() {
    if (!this.navArrowLeft || !this.navArrowRight) return
    
    const targetOrder = ['left', 'front', 'right']
    const currentIndex = targetOrder.indexOf(this.currentTarget)
    
    const labelMap = {
      left: 'Panel Talk',
      front: 'Exhibition',
      right: 'Livestream'
    }
    
    if (currentIndex > 0) {
      this.navArrowLeft.style.opacity = ''
      this.navArrowLeft.style.pointerEvents = ''
      const leftTarget = targetOrder[currentIndex - 1]
      document.getElementById('nav-arrow-left-label').textContent = labelMap[leftTarget]
    } else {
      this.navArrowLeft.style.opacity = '0'
      this.navArrowLeft.style.pointerEvents = 'none'
    }
    
    if (currentIndex < 2) {
      this.navArrowRight.style.opacity = ''
      this.navArrowRight.style.pointerEvents = ''
      const rightTarget = targetOrder[currentIndex + 1]
      document.getElementById('nav-arrow-right-label').textContent = labelMap[rightTarget]
    } else {
      this.navArrowRight.style.opacity = '0'
      this.navArrowRight.style.pointerEvents = 'none'
    }
  }

  setupExhibitionOverview() {
    this.exhibitionOverview = document.getElementById('exhibition-overview')
    this.exhibitionOverviewBtn = document.getElementById('exhibition-overview-btn')
    
    if (this.exhibitionOverviewBtn) {
      this.exhibitionOverviewBtn.addEventListener('click', () => {
        this.hideExhibitionOverview()
        this.experience.transitionToTree(this.treeLandingScrollProgress)
      })
    }
  }
  
  showExhibitionOverview() {
    if (this.exhibitionOverview && !this.exhibitionOverviewShown) {
      this.exhibitionOverview.classList.add('is-visible')
      this.exhibitionOverviewShown = true
    }
  }
  
  hideExhibitionOverview() {
    if (this.exhibitionOverview) {
      this.exhibitionOverview.classList.remove('is-visible')
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
    this.hideExitConfirmation()
    this.isAtExitPoint = false
    this.inScene = false
    
    if (this.experience.world && this.experience.world.onExitScene) {
      this.experience.world.onExitScene(this.currentTarget)
    }
    
    this.previousTarget = this.currentTarget
    this.currentTarget = 'front'
    this.isSceneTransitioning = true
    
    // Hide scene hint during fly-back
    if (this.sceneHint) this.sceneHint.classList.remove('is-visible')
    
    let newAngle = this.targets.front.angle
    let angleDiff = newAngle - this.rotationY
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    const finalRotation = this.rotationY + angleDiff
    
    const endCamPos = this.startPosition.clone()
    const endLookAt = this.targets.front.position.clone()
    const startCamPos = this.camera.instance.position.clone()
    const startLookAt = this.targets[this.previousTarget].position.clone()
    
    this.camera.mode = 'transitioning'
    
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: this.sceneTransitionDuration,
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const lookTarget = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(lookTarget)
      },
      onComplete: () => {
        this.rotationY = finalRotation
        this.targetRotationY = finalRotation
        this.position.copy(this.startPosition)
        this.targetPosition.copy(this.startPosition)
        
        this.camera.walkPosition.copy(this.startPosition)
        this.camera.walkLookAtTarget = endLookAt.clone()
        this.camera.setWalkMode()
        
        this.isSceneTransitioning = false
        this.currentTopBarScene = 'default'
        this.updateTopBarCenter('default')
        this.showForestHint()
        this.setNavButtonsVisible(true)
        this.updateNavArrows()
      }
    })
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
    
    // Scene transition
    folder.add(this, 'sceneTransitionDuration').min(0.5).max(5).step(0.1).name('Transition Duration')
    
    // Approach settings
    folder.add(this, 'approachDistance').min(0).max(30).step(1).name('Point A (Entry)')
    folder.add(this, 'minDistanceToTarget').min(3).max(20).step(1).name('Point B (Closest)')
    folder.add(this, 'minDistanceLivestream').min(5).max(25).step(1).name('Livestream Min Dist')
    folder.add(this, 'exitDistance').min(10).max(40).step(1).name('Point C (Exit)')
    
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

    // Scene navigation arrow buttons
    this.navArrowLeft = document.getElementById('nav-arrow-left')
    this.navArrowRight = document.getElementById('nav-arrow-right')
    
    if (this.navArrowLeft) {
      this.navArrowLeft.addEventListener('click', () => {
        if (this.enabled && this.experience.phase === 'forest') {
          this.switchToNextTarget('left')
        }
      })
    }
    
    if (this.navArrowRight) {
      this.navArrowRight.addEventListener('click', () => {
        if (this.enabled && this.experience.phase === 'forest') {
          this.switchToNextTarget('right')
        }
      })
    }
  }

  onMouseDown(event) {
    if (event.button === 0) {
      this.isDragging = true
      this.dragAccumulatedX = 0
      this.previousMouseX = event.clientX
      this.previousMouseY = event.clientY
      document.body.style.cursor = 'grabbing'
    }
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
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateExhibitionOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.inShowcaseOrbit) {
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateShowcaseOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.experience.phase === 'tree') {
      this.focusDragDeltaX = deltaX
    } else if (this.experience.phase === 'forest' && !this.isSceneTransitioning) {
      this.dragAccumulatedX += deltaX
      if (this.dragAccumulatedX > this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('left')
      } else if (this.dragAccumulatedX < -this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('right')
      }
    } else {
      this.sceneDragOffsetX += deltaX * this.sceneDragStrength * 0.01
      this.sceneDragOffsetY += deltaY * this.sceneDragStrength * 0.01
      
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
      this.dragAccumulatedX = 0
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
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateExhibitionOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.inShowcaseOrbit) {
      const deltaAngle = -deltaX * this.exhibitionOrbitSensitivity
      const deltaHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateShowcaseOrbit(deltaAngle, 0, deltaHeight)
    } else if (this.experience.phase === 'forest' && !this.isSceneTransitioning) {
      this.dragAccumulatedX += deltaX
      if (this.dragAccumulatedX > this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('left')
      } else if (this.dragAccumulatedX < -this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('right')
      }
    } else {
      this.sceneDragOffsetX += deltaX * this.sceneDragStrength * 0.01
      this.sceneDragOffsetY += deltaY * this.sceneDragStrength * 0.01
      
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
    } else if (this.experience.phase === 'forest' && !this.isSceneTransitioning && !this.exhibitionOverviewShown) {
      const scrollDelta = Math.sign(event.deltaY) * this.moveSpeed
      this.moveVelocity += scrollDelta

    } else if (this.experience.phase === 'tree') {
      this.targetScrollProgress -= event.deltaY * this.scrollSensitivity
      this.targetScrollProgress = THREE.MathUtils.clamp(this.targetScrollProgress, 0, 1)
    }
  }

  onKeyDown(event) {
    if (this.exitConfirmationShown) return
    
    if (this.experience.phase === 'forest' && !this.isSceneTransitioning) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        this.switchToNextTarget('left')
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        this.switchToNextTarget('right')
      }
    }
    
    if (event.code === 'Escape' && this.experience.phase === 'tree') {
      this.experience.transitionToForest()
    }
  }

  onKeyUp(event) {
    // Currently not needed, but here for future use
  }

  // Switch to the next target in the given direction
  switchToNextTarget(direction) {
    if (this.isSceneTransitioning) return
    
    const targetOrder = ['left', 'front', 'right']
    const currentIndex = targetOrder.indexOf(this.currentTarget)
    
    let newIndex
    if (direction === 'left') {
      newIndex = currentIndex - 1
      if (newIndex < 0) newIndex = 0
    } else {
      newIndex = currentIndex + 1
      if (newIndex > 2) newIndex = 2
    }
    
    const newTarget = targetOrder[newIndex]
    
    if (newTarget !== this.currentTarget) {
      this.previousTarget = this.currentTarget
      this.currentTarget = newTarget
      this.isSceneTransitioning = true
      
      // Calculate final navigation state
      let newAngle = this.targets[newTarget].angle
      let angleDiff = newAngle - this.rotationY
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      const finalRotation = this.rotationY + angleDiff
      
      const targetObj = this.targets[this.currentTarget]
      const dirToTarget = new THREE.Vector3()
        .subVectors(targetObj.position, this.startPosition).normalize()
      const finalNavPosition = this.startPosition.clone().add(
        dirToTarget.multiplyScalar(this.approachDistance)
      )
      finalNavPosition.y = 1.6
      
      // The camera end position IS the final nav position (walk mode copies position directly)
      const endCamPos = finalNavPosition.clone()
      // The camera end lookAt IS the target object position
      const endLookAt = targetObj.position.clone()
      
      // Capture current camera state as the start
      const startCamPos = this.camera.instance.position.clone()
      const startLookAt = this.targets[this.previousTarget].position.clone()
      
      // Hide all bottom hints during transition
      this.setNavButtonsVisible(false)
      if (this.forestHint) this.forestHint.classList.add('is-hidden')
      if (this.sceneHint) this.sceneHint.classList.remove('is-visible')
      
      // Update top bar for the target scene
      if (newTarget === 'left' || newTarget === 'right') {
        this.currentTopBarScene = newTarget
        this.updateTopBarCenter(newTarget)
      } else {
        this.currentTopBarScene = 'default'
        this.updateTopBarCenter('default')
      }
      
      // Switch camera to transitioning so the update loop doesn't fight
      this.camera.mode = 'transitioning'
      
      // Animate camera directly
      const progress = { value: 0 }
      gsap.to(progress, {
        value: 1,
        duration: this.sceneTransitionDuration,
        ease: 'sine.inOut',
        onUpdate: () => {
          const t = progress.value
          
          this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
          
          const lookTarget = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
          this.camera.instance.lookAt(lookTarget)
        },
        onComplete: () => {
          this.rotationY = finalRotation
          this.targetRotationY = finalRotation
          this.position.copy(finalNavPosition)
          this.targetPosition.copy(finalNavPosition)
          
          this.camera.walkPosition.copy(finalNavPosition)
          this.camera.walkLookAtTarget = endLookAt.clone()
          this.camera.setWalkMode()
          
          this.isSceneTransitioning = false
          
          // For Panel Talk / Livestream: show welcome popup immediately
          if (newTarget === 'left' || newTarget === 'right') {
            this.showSceneWelcome(newTarget)
          } else {
            // Returning to front — restore forest UI
            this.showForestHint()
            this.setNavButtonsVisible(true)
            this.updateNavArrows()
          }
        }
      })
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
    // During GSAP scene transition, skip lerp — GSAP drives rotation & position
    if (!this.isSceneTransitioning) {
      this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, 0.05)
      
      if (!this.isDragging) {
        this.position.lerp(this.targetPosition, this.positionLerpSpeed)
      }
    }

    // Handle scroll movement toward current target direction
    // Block movement when exit confirmation, welcome popup, or exhibition overview is shown
    if (Math.abs(this.moveVelocity) > 0.001 && !this.exitConfirmationShown && !this.welcomeShown && !this.exhibitionOverviewShown && !this.isSceneTransitioning) {
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
      
      if (this.currentTarget !== 'front') {
        // Panel Talk / Livestream scene — scroll to navigate within scene
        if (!this.inScene) {
          // Not yet entered scene, block scrolling
          this.moveVelocity = 0
          return
        }
        
        // Scrolling backward to entry point triggers exit confirmation
        if (distanceFromStart <= 0) {
          this.position.copy(this.startPosition.clone().add(forward.clone().multiplyScalar(0)))
          this.position.y = 1.6
          this.targetPosition.copy(this.position)
          this.moveVelocity = 0
          this.showExitConfirmation()
        } else if (distanceFromStart >= 0) {
          const minDist = this.currentTarget === 'right' ? this.minDistanceLivestream : this.minDistanceToTarget
          if (distanceToTarget >= minDist) {
            this.position.copy(newPosition)
          }
        }
      } else {
        // Front (Exhibition/tree) — scroll forward to approach tree
        const treeMinDistance = this.transitionDistance - 2
        if (distanceFromStart >= 0 && distanceToTarget >= treeMinDistance) {
          this.position.copy(newPosition)
        } else if (distanceFromStart < 0) {
          // Block scrolling backward past landing position
          this.position.copy(this.startPosition.clone())
          this.position.y = 1.6
          this.moveVelocity = 0
        }
      }
      
      this.moveVelocity *= this.moveDamping
      
      // Update target position to current position (so it doesn't snap back)
      this.targetPosition.copy(this.position)
    } else if (this.exitConfirmationShown || this.welcomeShown || this.exhibitionOverviewShown) {
      // Stop all movement when confirmation, welcome, or overview is shown
      this.moveVelocity = 0
    }

    // Keep at eye height
    this.position.y = 1.6
    this.targetPosition.y = 1.6

    // Fade nav buttons based on scroll distance from landing (only when facing Exhibition)
    if (this.currentTarget === 'front' && !this.isSceneTransitioning) {
      const distFromStart = this.position.distanceTo(this.startPosition)
      const fadeStart = 1.0
      const fadeEnd = 4.0
      
      if (distFromStart <= fadeStart) {
        this.setNavButtonsVisible(true)
      } else if (distFromStart >= fadeEnd) {
        this.setNavButtonsVisible(false)
      } else {
        const fadeProgress = (distFromStart - fadeStart) / (fadeEnd - fadeStart)
        const opacity = 1 - fadeProgress
        if (this.navArrowLeft) {
          this.navArrowLeft.style.opacity = opacity
          this.navArrowLeft.style.pointerEvents = opacity < 0.3 ? 'none' : ''
        }
        if (this.navArrowRight) {
          this.navArrowRight.style.opacity = opacity
          this.navArrowRight.style.pointerEvents = opacity < 0.3 ? 'none' : ''
        }
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

    // Show exhibition overview popup at halfway to tree (only when facing tree)
    if (this.currentTarget === 'front' && !this.exhibitionOverviewShown) {
      const forward = new THREE.Vector3()
      forward.subVectors(this.targets.front.position, this.startPosition).normalize()
      const toPos = new THREE.Vector3().subVectors(this.position, this.startPosition)
      const dist = toPos.dot(forward)
      if (dist >= this.halfwayDistance) {
        this.moveVelocity = 0
        this.showExhibitionOverview()
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
    this.moveVelocity = 0
    this.currentTarget = 'front'
    this.previousTarget = 'front'
    this.inScene = false
    this.exhibitionOverviewShown = false
    
    this.currentTopBarScene = 'default'
    this.updateTopBarCenter('default')
    this.showForestHint()
    this.setNavButtonsVisible(true)
    this.updateNavArrows()
  }

  dispose() {
    // Event listeners will be garbage collected with the page
  }
}
