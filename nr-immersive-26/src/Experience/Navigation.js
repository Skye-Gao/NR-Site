import * as THREE from 'three'
import gsap from 'gsap'
import Experience from './Experience.js'
import {
  LIVESTREAM_WELCOME_TITLE,
  LIVESTREAM_WELCOME_HTML
} from './Utils/livestreamWelcomeContent.js'
import { WORLD_GROUND_LEVEL_Y, getWalkEyeWorldY } from './World/worldGroundLevel.js'

export default class Navigation {
  constructor() {
    this.experience = new Experience()
    this.camera = this.experience.camera
    this.time = this.experience.time
    this.debug = this.experience.debug

    // Enable/disable navigation
    this.enabled = true

    // Starting position - center of equilateral triangle
    this.startPosition = new THREE.Vector3(0, getWalkEyeWorldY(), 0)
    this.position = this.startPosition.clone()

    // Distance from center to each vertex
    this.targetDistance = 60

    // Target positions - equilateral triangle vertices (120° apart)
    // Tree at front (0°), Cube at back-left (120°), Sphere at back-right (-120°)
    this.targets = {
      front: { 
        position: new THREE.Vector3(0, 2 + WORLD_GROUND_LEVEL_Y, -this.targetDistance), 
        angle: 0 
      },
      left: { 
        position: new THREE.Vector3(
          -this.targetDistance * Math.sin(Math.PI * 2 / 3),  // -21.65
          2 + WORLD_GROUND_LEVEL_Y, 
          -this.targetDistance * Math.cos(Math.PI * 2 / 3)   // 12.5
        ), 
        angle: Math.PI * 2 / 3  // 120 degrees
      },
      right: { 
        position: new THREE.Vector3(
          -this.targetDistance * Math.sin(-Math.PI * 2 / 3), // 21.65
          6 + WORLD_GROUND_LEVEL_Y,  // Livestream screen center (group + screen local Y)
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
    
    // Panel Talk gallery-stop navigation (screen-by-screen)
    this.panelStops = []
    this.panelStopIndex = -1 // -1 means landing position before screen 1
    this.panelLandingPosition = null
    this.panelLookAtOverride = null
    this.panelIsMoving = false
    this.panelStopTransitionDuration = 2.4
    this.panelWheelAccumulator = 0
    this.panelWheelThreshold = 40
    this.panelWheelLockUntil = 0
    // Normalize Panel Talk so forward scroll advances deeper into gallery.
    this.panelWheelDirectionFactor = 1
    this.panelProgressTooltip = null

    /** Touch: 1-finger vertical pan maps to wheel-like scroll; 2-finger pinch zooms in orbit. */
    this._touchGesture = null // null | 'undecided' | 'pan-scroll' | 'orbit'
    this._touchStartX = 0
    this._touchStartY = 0
    this._touchPinchLastDist = 0
    this._touchSlopPx = 12
    this._touchPanScale = 1.35
    this._touchPinchRadiusScale = 2.8
    /** Forest walk: touch pans accumulate before emitting moveVelocity impulses (wheel stays discrete). */
    this._touchForestWalkAccum = 0
    this._touchTreeHubAccum = 0
    this.panelCameraLift = 0.9
    this.panelLookDownOffset = 0.7

    // Mouse state
    this.isDragging = false
    this.previousMouseX = 0
    this.previousMouseY = 0

    // Mouse look - view movement following cursor
    this.mouseLookStrength = 2.0  // How much the view follows the mouse
    this.defaultMouseLookStrength = 2.0
    this.panelTalkMouseLookStrength = 0.8
    this.livestreamMouseLookStrength = 0.8
    this.mouseX = 0  // -1 to 1 (left to right)
    this.mouseY = 0  // -1 to 1 (top to bottom)
    this.currentMouseX = 0  // Smoothed value
    this.currentMouseY = 0  // Smoothed value
    this.mouseLookSmoothing = 0.04  // How smooth the follow is (lower = more fluid lag)
    
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
    this.halfwayDistance = this.targetDistance / 3  // One-third distance to tree
    this.treeLandingScrollProgress = 0.5  // Where on the tree the camera lands
    this.inTreeHub = false
    this.treeHubDistanceFromStart = 46
    this.treeHubReturnDistanceFromStart = this.halfwayDistance
    this.treeHubRevealDistanceFromStart = this.treeHubDistanceFromStart + 7
    this.treeHubScrollStep = 1.1
    this.treeHubScrollDeadzone = 1
    this.treeHubForwardScrollSign = 1
    this.treeHubMouseLookStrength = 0.8
    this.treeHubButtonsTimer = null
    this.treeHubButtonsShown = false
    this.treeHubLookLockUntil = 0
    
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
    this.setupPanelProgress()
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
    this.sceneWelcomeContent = document.querySelector('.scene-welcome-content')
    this.sceneWelcomeTitle = document.getElementById('scene-welcome-title')
    this.sceneWelcomeDescription = document.getElementById('scene-welcome-description')
    this.sceneWelcomeClose = document.getElementById('scene-welcome-close')
    this.sceneWelcomeEnter = document.getElementById('scene-welcome-enter')
    this.welcomeShown = false  // Block scrolling while popup is shown
    this.pendingWelcome = false  // True when switched to scene, waiting to show welcome on scroll

    // Scene content
    this.sceneContent = {
      left: {
        title: 'Welcome to Panel discussions',
        description: 'Join us for insightful discussions with industry experts, artists, and thought leaders. Explore the intersection of nature, technology, and creativity through engaging panel sessions.'
      },
      right: {
        title: LIVESTREAM_WELCOME_TITLE,
        html: LIVESTREAM_WELCOME_HTML
      }
    }

    this.livestreamInfoOpen = false
    this.livestreamInfoBtn = document.getElementById('livestream-info-btn')
    this.livestreamInfoModal = document.getElementById('livestream-info-modal')
    this.livestreamInfoTitle = document.getElementById('livestream-info-title')
    this.livestreamInfoBody = document.getElementById('livestream-info-body')
    this.livestreamInfoClose = document.getElementById('livestream-info-close')

    if (this.livestreamInfoBtn) {
      this.livestreamInfoBtn.addEventListener('click', () => {
        if (!this.livestreamInfoBtn.classList.contains('is-visible')) return
        this.openLivestreamInfoModal()
      })
    }
    if (this.livestreamInfoClose) {
      this.livestreamInfoClose.addEventListener('click', () => this.closeLivestreamInfoModal())
    }
    if (this.livestreamInfoModal) {
      this.livestreamInfoModal.addEventListener('click', (e) => {
        if (e.target === this.livestreamInfoModal) this.closeLivestreamInfoModal()
      })
    }

    // Close button listeners
    if (this.sceneWelcomeClose) {
      this.sceneWelcomeClose.addEventListener('click', () => this.closeSceneWelcome())
    }
    if (this.sceneWelcomeEnter) {
      this.sceneWelcomeEnter.addEventListener('click', () => this.closeSceneWelcome())
    }
  }

  setupPanelProgress() {
    this.panelProgress = document.getElementById('panel-progress')
    this.panelProgressPoints = document.getElementById('panel-progress-points')
    this.panelProgressButtons = []
    this.panelProgressTooltip = document.getElementById('panel-progress-tooltip')
    if (!this.panelProgressTooltip) {
      this.panelProgressTooltip = document.createElement('div')
      this.panelProgressTooltip.id = 'panel-progress-tooltip'
      this.panelProgressTooltip.className = 'panel-progress-tooltip'
      document.body.appendChild(this.panelProgressTooltip)
    }
    if (!this.panelProgressPoints) return

    this.panelProgressPoints.addEventListener('click', (e) => {
      const btn = e.target.closest('.panel-progress-point')
      if (!btn) return
      if (!this.enabled) return
      if (!this.inScene || this.currentTarget !== 'left') return
      if (this.panelIsMoving) return
      const index = Number(btn.dataset.stopIndex)
      if (!Number.isFinite(index)) return
      if (index === this.panelStopIndex) return
      this.transitionToPanelStop(index)
    })

    this.panelProgressPoints.addEventListener('pointermove', (e) => {
      const btn = e.target.closest('.panel-progress-point')
      if (!btn || !this.panelProgress?.classList.contains('is-visible')) {
        this.hidePanelProgressTooltip()
        return
      }
      this.showPanelProgressTooltip(btn, e.clientX, e.clientY)
    })

    this.panelProgressPoints.addEventListener('pointerleave', () => {
      this.hidePanelProgressTooltip()
    })

    this.panelProgressPoints.addEventListener('focusin', (e) => {
      const btn = e.target.closest('.panel-progress-point')
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      this.showPanelProgressTooltip(btn, rect.left + rect.width / 2, rect.top + rect.height / 2)
    })

    this.panelProgressPoints.addEventListener('focusout', () => {
      this.hidePanelProgressTooltip()
    })
  }

  rebuildPanelProgressStops() {
    if (!this.panelProgressPoints) return
    this.panelProgressPoints.innerHTML = ''
    this.panelProgressButtons = []
    if (!this.panelStops.length) {
      this.refreshPanelProgressVisibility()
      return
    }

    const n = this.panelStops.length
    this.panelStops.forEach((stop, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'panel-progress-point'
      btn.dataset.stopIndex = `${i}`
      const stopLabel = this.formatPanelStopLabel(stop, i)
      btn.dataset.stopLabel = stopLabel
      btn.setAttribute('aria-label', `Go to ${stopLabel.replace(/\n/g, ', ')}`)
      const pct = n === 1 ? 50 : (i / (n - 1)) * 100
      btn.style.top = `${pct}%`
      this.panelProgressPoints.appendChild(btn)
      this.panelProgressButtons.push(btn)
    })

    this.updatePanelProgressActiveStop()
    this.refreshPanelProgressVisibility()
  }

  updatePanelProgressActiveStop() {
    if (!this.panelProgressButtons?.length) return
    this.panelProgressButtons.forEach((btn, i) => {
      btn.classList.toggle('is-active', i === this.panelStopIndex)
    })
  }

  refreshPanelProgressVisibility() {
    if (!this.panelProgress) return
    const exp = this.experience
    const hideForOverlay =
      this.exitConfirmationShown ||
      this.welcomeShown ||
      this.exhibitionOverviewShown ||
      this.isSceneTransitioning ||
      exp.isTransitioning ||
      this.experience.sections?.orbitTransitioning ||
      this.experience.videoPopup?.isOpen

    const show =
      exp.phase === 'forest' &&
      this.inScene &&
      this.currentTarget === 'left' &&
      this.panelStops.length > 0 &&
      !hideForOverlay

    this.panelProgress.classList.toggle('is-visible', show)
    if (!show) this.hidePanelProgressTooltip()
  }

  formatPanelStopLabel(stop, index) {
    const info = stop?.eventInfo
    if (!info) return `Panel display ${index + 1}`
    return `${info.title}\n${info.date}\n${info.time}`
  }

  showPanelProgressTooltip(btn, x, y) {
    if (!this.panelProgressTooltip || !btn) return
    const label = btn.dataset.stopLabel || ''
    if (!label) {
      this.hidePanelProgressTooltip()
      return
    }
    this.panelProgressTooltip.textContent = label
    const tip = this.panelProgressTooltip
    const gap = 14
    const pad = 10
    const tipWidth = tip.offsetWidth || 240
    const tipHeight = tip.offsetHeight || 90

    // Prefer left-of-cursor placement (panel bar is on right side of viewport).
    let left = x - tipWidth - gap
    if (left < pad) left = pad

    let top = y - tipHeight / 2
    const maxTop = window.innerHeight - tipHeight - pad
    if (top < pad) top = pad
    if (top > maxTop) top = Math.max(pad, maxTop)

    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
    this.panelProgressTooltip.classList.add('is-visible')
  }

  hidePanelProgressTooltip() {
    if (!this.panelProgressTooltip) return
    this.panelProgressTooltip.classList.remove('is-visible')
  }

  openLivestreamInfoModal() {
    if (!this.livestreamInfoModal || !this.livestreamInfoTitle || !this.livestreamInfoBody) return
    this.livestreamInfoTitle.textContent = LIVESTREAM_WELCOME_TITLE
    this.livestreamInfoBody.innerHTML = LIVESTREAM_WELCOME_HTML
    this.livestreamInfoModal.classList.add('is-visible')
    this.livestreamInfoModal.setAttribute('aria-hidden', 'false')
    this.livestreamInfoOpen = true
    this.refreshLivestreamInfoButton()
  }

  closeLivestreamInfoModal() {
    if (!this.livestreamInfoModal) return
    this.livestreamInfoModal.classList.remove('is-visible')
    this.livestreamInfoModal.setAttribute('aria-hidden', 'true')
    this.livestreamInfoOpen = false
    this.refreshLivestreamInfoButton()
  }

  refreshLivestreamInfoButton() {
    const btn = this.livestreamInfoBtn
    if (!btn) return
    const exp = this.experience
    const hideForOverlay =
      this.exitConfirmationShown ||
      this.welcomeShown ||
      this.exhibitionOverviewShown ||
      this.isSceneTransitioning ||
      exp.isTransitioning ||
      this.experience.sections?.orbitTransitioning ||
      this.livestreamInfoOpen ||
      this.experience.videoPopup?.isOpen

    const show =
      exp.phase === 'forest' &&
      this.inScene &&
      this.currentTarget === 'right' &&
      !hideForOverlay

    btn.classList.toggle('is-visible', show)
  }
  
  showSceneWelcome(scene) {
    if (!this.sceneWelcome || !this.sceneContent[scene]) return

    const content = this.sceneContent[scene]
    this.sceneWelcomeTitle.textContent = content.title

    if (scene === 'right' && content.html) {
      this.sceneWelcomeDescription.innerHTML = content.html
      this.sceneWelcomeContent?.classList.add('scene-welcome-content--livestream')
    } else {
      this.sceneWelcomeDescription.textContent = content.description
      this.sceneWelcomeContent?.classList.remove('scene-welcome-content--livestream')
    }

    this.sceneWelcome.classList.add('is-visible')
    this.welcomeShown = true
  }
  
  closeSceneWelcome() {
    if (!this.sceneWelcome) return

    const isLivestream =
      this.currentTarget === 'right' ||
      this.sceneWelcomeContent?.classList.contains('scene-welcome-content--livestream')

    if (isLivestream) {
      this.sceneWelcome.classList.add('scene-welcome--close-instant')
      void this.sceneWelcome.offsetHeight
      this.sceneWelcome.classList.remove('is-visible')
      this.sceneWelcomeContent?.classList.remove('scene-welcome-content--livestream')
      this.sceneWelcome.classList.remove('scene-welcome--close-instant')
    } else {
      this.sceneWelcomeContent?.classList.remove('scene-welcome-content--livestream')
      this.sceneWelcome.classList.remove('is-visible')
    }

    this.welcomeShown = false
    this.inScene = true
    if (this.currentTarget === 'left') {
      this.initializePanelTalkStops()
    }
    
    // Show scene navigation hint
    this.showSceneHintWithName(this.currentTarget)
    
    // Notify world that we've entered the scene (for video playback etc.)
    if (this.experience.world && this.experience.world.onEnterScene) {
      this.experience.world.onEnterScene(this.currentTarget)
    }
  }

  enterTreeHub(position, lookAtTarget) {
    this.inTreeHub = true
    this.inScene = false
    this.currentTarget = 'front'
    this.previousTarget = 'front'
    this.mouseLookStrength = this.treeHubMouseLookStrength
    this.position.copy(position)
    this.targetPosition.copy(position)
    this.camera.walkPosition.copy(position)
    this.camera.walkLookAtTarget = lookAtTarget.clone()
    this.moveVelocity = 0
    this.mouseX = 0
    this.mouseY = 0
    this.currentMouseX = 0
    this.currentMouseY = 0
    this.sceneDragOffsetX = 0
    this.sceneDragOffsetY = 0
    this.treeHubLookLockUntil = performance.now() + 350
    if (this.forestHint) this.forestHint.classList.add('is-hidden')
    if (this.sceneHint) this.sceneHint.classList.add('is-visible')
    const sceneHintName = document.getElementById('scene-hint-name')
    if (sceneHintName) sceneHintName.textContent = 'Gallery'
    this.treeHubButtonsShown = true
    if (this.treeHubButtonsTimer) {
      clearTimeout(this.treeHubButtonsTimer)
      this.treeHubButtonsTimer = null
    }
    // Hub button visibility: sections.showTreeHub() sets tree-hub-mode then setTreeHubControlsProgress(1).
  }

  exitTreeHub() {
    this.inTreeHub = false
    this.treeHubButtonsShown = false
    this.treeHubLookLockUntil = 0
    if (this.sceneHint) this.sceneHint.classList.remove('is-visible')
    if (this.treeHubButtonsTimer) {
      clearTimeout(this.treeHubButtonsTimer)
      this.treeHubButtonsTimer = null
    }
    // Always tear down tree-hub UI when leaving landing (orbit, forest, etc.).
    this.experience.sections?.hideTreeHub()
  }

  initializePanelTalkStops() {
    const panelTalk = this.experience.world?.panelTalkScene
    if (!panelTalk?.getGalleryStops) return

    this.panelLandingPosition = this.position.clone()
    this.panelStops = panelTalk.getGalleryStops(
      this.panelLandingPosition,
      this.getEyeYForScene('left')
    )
    this.panelStopIndex = -1
    this.panelLookAtOverride = this.getSceneLookAt(this.targets.left.position.clone(), 'left')
    this.panelIsMoving = false
    this.panelWheelAccumulator = 0
    this.panelWheelLockUntil = 0
    this.rebuildPanelProgressStops()
  }

  clearPanelTalkStops() {
    this.panelStops = []
    this.panelStopIndex = -1
    this.panelLandingPosition = null
    this.panelLookAtOverride = null
    this.panelIsMoving = false
    this.panelWheelAccumulator = 0
    this.panelWheelLockUntil = 0
    this.rebuildPanelProgressStops()
  }

  movePanelTalkByScroll(deltaY) {
    if (!this.inScene || this.currentTarget !== 'left' || this.panelIsMoving) return
    if (this.exitConfirmationShown || this.welcomeShown || this.isSceneTransitioning) return

    const now = performance.now()
    if (now < this.panelWheelLockUntil) return

    this.panelWheelAccumulator += deltaY
    if (Math.abs(this.panelWheelAccumulator) < this.panelWheelThreshold) return

    const direction = Math.sign(this.panelWheelAccumulator) * this.panelWheelDirectionFactor
    this.panelWheelAccumulator = 0
    this.panelWheelLockUntil = now + 260

    if (direction > 0) {
      // Scroll forward to next screen stop
      const nextIndex = Math.min(this.panelStopIndex + 1, this.panelStops.length - 1)
      if (nextIndex !== this.panelStopIndex) {
        this.transitionToPanelStop(nextIndex)
      }
      return
    }

    // Scroll backward: previous stop, then landing, then exit confirm
    if (this.panelStopIndex >= 0) {
      this.transitionToPanelStop(this.panelStopIndex - 1)
      return
    }

    this.showExitConfirmation()
  }

  transitionToPanelStop(nextIndex) {
    const landingLookAt = this.getSceneLookAt(this.targets.left.position.clone(), 'left')
    const startCamPos = this.camera.instance.position.clone()
    const startLookAt = (this.panelLookAtOverride || this.targets.left.position).clone()

    let endPos
    let endLookAt
    if (nextIndex < 0) {
      endPos = (this.panelLandingPosition || this.position).clone()
      endLookAt = landingLookAt
    } else {
      const stop = this.panelStops[nextIndex]
      if (!stop) return
      endPos = stop.position.clone()
      endLookAt = this.getSceneLookAt(stop.lookAt.clone(), 'left')
    }

    this.panelIsMoving = true
    this.moveVelocity = 0
    this.panelWheelLockUntil = performance.now() + this.panelStopTransitionDuration * 1000
    this.camera.mode = 'transitioning'

    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: this.panelStopTransitionDuration,
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endPos, t)
        const lookTarget = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(lookTarget)
      },
      onComplete: () => {
        this.panelStopIndex = nextIndex
        this.position.copy(endPos)
        this.targetPosition.copy(endPos)
        this.camera.instance.position.copy(endPos)
        this.camera.instance.lookAt(endLookAt)
        this.camera.walkPosition.copy(endPos)
        this.panelLookAtOverride = endLookAt.clone()
        this.camera.walkLookAtTarget = endLookAt.clone()
        this.camera.setWalkMode()
        this.panelIsMoving = false
        this.updatePanelProgressActiveStop()
      }
    })
  }
  
  setExhibitionOrbitMode(enabled) {
    this.inExhibitionOrbit = enabled
  }
  
  setShowcaseOrbitMode(enabled) {
    this.inShowcaseOrbit = enabled
  }

  getEyeYForScene(target = this.currentTarget) {
    const base = getWalkEyeWorldY()
    return target === 'left' ? base + this.panelCameraLift : base
  }

  getSceneLookAt(lookAt, target = this.currentTarget) {
    if (!lookAt) return lookAt
    if (target !== 'left') return lookAt
    const next = lookAt.clone()
    next.y -= this.panelLookDownOffset
    return next
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
      front: 'Gallery',
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
    this.exitToForestBtn = document.getElementById('exit-to-forest-btn')

    if (this.exitBtnYes) {
      this.exitBtnYes.addEventListener('click', () => this.onExitConfirm())
    }
    if (this.exitBtnNo) {
      this.exitBtnNo.addEventListener('click', () => this.onExitCancel())
    }
    if (this.exitToForestBtn) {
      this.exitToForestBtn.addEventListener('click', () => {
        if (!this.exitToForestBtn.classList.contains('is-visible')) return
        this.showExitConfirmation()
      })
    }
  }

  refreshExitToForestButton() {
    const btn = this.exitToForestBtn
    if (!btn) return
    const exp = this.experience
    const inSideScene =
      exp.phase === 'forest' &&
      this.inScene &&
      !this.welcomeShown &&
      (this.currentTarget === 'left' || this.currentTarget === 'right')
    const inOrbit = this.inExhibitionOrbit || this.inShowcaseOrbit
    const inTreePhase = exp.phase === 'tree'
    const sec = exp.sections
    const treeEntryModalOpen =
      inTreePhase &&
      sec &&
      (sec.exhibitionEntry?.classList.contains('is-visible') ||
        sec.showcaseEntry?.classList.contains('is-visible'))
    const overviewVisible = this.exhibitionOverview?.classList.contains('is-visible')
    const hideForOverlay =
      this.exitConfirmationShown ||
      this.welcomeShown ||
      overviewVisible ||
      this.isSceneTransitioning ||
      exp.isTransitioning ||
      this.experience.sections?.orbitTransitioning
    const show =
      (inSideScene ||
        inOrbit ||
        (inTreePhase && !treeEntryModalOpen)) &&
      !hideForOverlay
    btn.classList.toggle('is-visible', show)
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
    this.closeLivestreamInfoModal()

    // Any tree-mode context (hub, focus scroll, exhibition/showcase orbit) exits to forest.
    if (this.experience.phase === 'tree') {
      this.hideExitConfirmation()
      this.isAtExitPoint = false
      this.inScene = false
      this.exitTreeHub()
      this.clearPanelTalkStops()
      this.mouseLookStrength = this.defaultMouseLookStrength
      this.experience.transitionToForest()
      return
    }

    // Exhibition / AWS orbit: leave tree scene for forest (same dialog as scroll exit from tree hub)
    if (this.inExhibitionOrbit || this.inShowcaseOrbit) {
      this.hideExitConfirmation()
      this.isAtExitPoint = false
      this.inScene = false
      this.exitTreeHub()
      this.clearPanelTalkStops()
      this.experience.transitionToForest()
      return
    }

    this.hideExitConfirmation()
    this.isAtExitPoint = false
    this.inScene = false
    this.exitTreeHub()
    this.clearPanelTalkStops()
    
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
        this.mouseLookStrength = this.defaultMouseLookStrength
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

    if (this.inTreeHub) {
      const forward = new THREE.Vector3()
      forward.subVectors(this.targets.front.position, this.startPosition).normalize()
      const treeHubPos = this.startPosition.clone().add(
        forward.multiplyScalar(this.treeHubDistanceFromStart)
      )
      treeHubPos.y = getWalkEyeWorldY()
      const startCamPos = this.camera.instance.position.clone()
      const endLookAt = this.targets.front.position.clone()
      this.isSceneTransitioning = true
      this.camera.mode = 'transitioning'
      const progress = { value: 0 }
      gsap.to(progress, {
        value: 1,
        duration: 1.0,
        ease: 'sine.inOut',
        onUpdate: () => {
          this.camera.instance.position.lerpVectors(startCamPos, treeHubPos, progress.value)
          this.camera.instance.lookAt(endLookAt)
        },
        onComplete: () => {
          this.position.copy(treeHubPos)
          this.targetPosition.copy(treeHubPos)
          this.camera.walkPosition.copy(treeHubPos)
          this.camera.walkLookAtTarget = endLookAt.clone()
          this.camera.setWalkMode()
          this.isSceneTransitioning = false
          this.experience.sections?.setTreeHubControlsProgress(this.treeHubButtonsShown ? 1 : 0)
          this.moveVelocity = 0
        }
      })
      return
    }

    if (this.inExhibitionOrbit || this.inShowcaseOrbit) {
      return
    }
    
    // Calculate entry point (approach distance from start toward current target)
    const currentTargetObj = this.targets[this.currentTarget]
    const directionToTarget = new THREE.Vector3()
    directionToTarget.subVectors(currentTargetObj.position, this.startPosition).normalize()
    
    this.targetPosition = this.startPosition.clone().add(
      directionToTarget.multiplyScalar(this.approachDistance)
    )
    this.targetPosition.y = getWalkEyeWorldY()
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
    } else if (this.experience.phase === 'tree' && !this.inTreeHub) {
      this.focusDragDeltaX = deltaX
    } else if (this.experience.phase === 'forest' && !this.isSceneTransitioning && this.currentTarget === 'front') {
      this.dragAccumulatedX += deltaX
      if (this.dragAccumulatedX > this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('left')
      } else if (this.dragAccumulatedX < -this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('right')
      }
    } else if (!this.inTreeHub) {
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

  shouldIgnoreWheelScrollTarget(target) {
    return !!target?.closest?.(
      '.artwork-popup.is-visible .artwork-popup-media-scroll, .artwork-popup.is-visible .artwork-popup-text-scroll'
    )
  }

  /** True when touch should not start a scene gesture (buttons, popups, forms). */
  isTouchOnInteractiveUI(target) {
    return !!target?.closest?.(
      [
        'button',
        'a',
        'input',
        'textarea',
        'select',
        'label',
        '.btn',
        '.nav-scene-btn',
        '.tree-hub-btn',
        '.back-button',
        '.scroll-label-btn',
        '.panel-progress-point',
        '.exit-to-forest-btn',
        '.livestream-info-btn',
        '.top-bar',
        '.scene-welcome',
        '.exhibition-entry',
        '.showcase-entry',
        '.exhibition-overview',
        '.exit-confirmation',
        '.artwork-popup',
        '.video-popup',
        '.landing-page',
        '.loading-screen',
      ].join(', ')
    )
  }

  getTouchDistance(touches) {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  /**
   * Same movement semantics as the mouse wheel (forest walk, tree scroll, panel stops, orbit zoom).
   * @param {{ smoothTouch?: boolean }} opts smoothTouch: coalesce small per-frame deltas (touch pan)
   * @returns {boolean} true if the delta was consumed (caller may preventDefault on touch).
   */
  applyWheelLikeDelta(deltaY, event = null, opts = {}) {
    if (event?.target && this.shouldIgnoreWheelScrollTarget(event.target)) return false

    if (this.inExhibitionOrbit) {
      const deltaRadius = deltaY * this.exhibitionZoomSensitivity
      this.camera.updateExhibitionOrbit(0, deltaRadius, 0)
      return true
    }
    if (this.inShowcaseOrbit) {
      const deltaRadius = deltaY * this.exhibitionZoomSensitivity
      this.camera.updateShowcaseOrbit(0, deltaRadius, 0)
      return true
    }
    if (this.experience.phase === 'forest' && this.currentTarget === 'left' && this.inScene) {
      this.movePanelTalkByScroll(deltaY)
      return true
    }
    if (this.inTreeHub) {
      if (opts.smoothTouch) {
        this._touchTreeHubAccum += deltaY
        const emit = 10
        if (Math.abs(this._touchTreeHubAccum) < emit) return true
        const burst = this._touchTreeHubAccum
        this._touchTreeHubAccum = 0
        this.handleTreeHubScroll(burst)
      } else {
        this.handleTreeHubScroll(deltaY)
      }
      return true
    }
    if (
      this.experience.phase === 'forest' &&
      !this.isSceneTransitioning &&
      !this.exhibitionOverviewShown
    ) {
      if (opts.smoothTouch) {
        this._touchForestWalkAccum += deltaY
        const threshold = 26
        while (this._touchForestWalkAccum > threshold) {
          this.moveVelocity += this.moveSpeed
          this._touchForestWalkAccum -= threshold
        }
        while (this._touchForestWalkAccum < -threshold) {
          this.moveVelocity -= this.moveSpeed
          this._touchForestWalkAccum += threshold
        }
      } else {
        const scrollDelta = Math.sign(deltaY) * this.moveSpeed
        this.moveVelocity += scrollDelta
      }
      return true
    }
    if (this.experience.phase === 'tree') {
      this.targetScrollProgress -= deltaY * this.scrollSensitivity
      this.targetScrollProgress = THREE.MathUtils.clamp(this.targetScrollProgress, 0, 1)
      return true
    }
    return false
  }

  onTouchStart(event) {
    if (this.exitConfirmationShown) return
    if (this.isTouchOnInteractiveUI(event.target)) return

    if (event.touches.length === 2 && (this.inExhibitionOrbit || this.inShowcaseOrbit)) {
      this._touchGesture = 'pinch'
      this._touchPinchLastDist = this.getTouchDistance(event.touches)
      this.isDragging = false
      return
    }

    if (event.touches.length !== 1) return

    const t = event.touches[0]
    this._touchGesture =
      this.inExhibitionOrbit || this.inShowcaseOrbit ? 'orbit' : 'undecided'
    this._touchStartX = t.clientX
    this._touchStartY = t.clientY
    this.isDragging = true
    this.dragAccumulatedX = 0
    this.previousMouseX = t.clientX
    this.previousMouseY = t.clientY
  }

  onTouchMove(event) {
    if (this.exitConfirmationShown) return

    if (event.touches.length === 2 && (this.inExhibitionOrbit || this.inShowcaseOrbit)) {
      if (this._touchGesture !== 'pinch') {
        this._touchGesture = 'pinch'
        this.isDragging = false
      }
      const d = this.getTouchDistance(event.touches)
      if (this._touchPinchLastDist <= 0) this._touchPinchLastDist = d
      const dd = d - this._touchPinchLastDist
      this._touchPinchLastDist = d
      const deltaRadius = dd * this.exhibitionZoomSensitivity * this._touchPinchRadiusScale
      if (this.inExhibitionOrbit) this.camera.updateExhibitionOrbit(0, deltaRadius, 0)
      else this.camera.updateShowcaseOrbit(0, deltaRadius, 0)
      event.preventDefault()
      return
    }

    if (event.touches.length !== 1) return
    if (!this.isDragging) return

    const t = event.touches[0]
    const x = t.clientX
    const y = t.clientY
    const deltaX = x - this.previousMouseX
    const deltaY = y - this.previousMouseY

    if (this._touchGesture === 'undecided') {
      const odx = Math.abs(x - this._touchStartX)
      const ody = Math.abs(y - this._touchStartY)
      if (odx + ody >= this._touchSlopPx) {
        const verticalDominant = ody > odx * 1.05
        this._touchGesture = verticalDominant ? 'pan-scroll' : 'orbit'
      } else {
        return
      }
    }

    if (this._touchGesture === 'pan-scroll') {
      const consumed = this.applyWheelLikeDelta(deltaY * this._touchPanScale, event, {
        smoothTouch: true,
      })
      if (consumed) event.preventDefault()
      this.previousMouseX = x
      this.previousMouseY = y
      return
    }

    // orbit-style drag (1 finger)
    if (this.inExhibitionOrbit) {
      const dAngle = -deltaX * this.exhibitionOrbitSensitivity
      const dHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateExhibitionOrbit(dAngle, 0, dHeight)
      event.preventDefault()
    } else if (this.inShowcaseOrbit) {
      const dAngle = -deltaX * this.exhibitionOrbitSensitivity
      const dHeight = deltaY * this.exhibitionVerticalSensitivity
      this.camera.updateShowcaseOrbit(dAngle, 0, dHeight)
      event.preventDefault()
    } else if (this.experience.phase === 'tree' && !this.inTreeHub) {
      this.focusDragDeltaX += deltaX
      event.preventDefault()
    } else if (
      this.experience.phase === 'forest' &&
      !this.isSceneTransitioning &&
      this.currentTarget === 'front'
    ) {
      this.dragAccumulatedX += deltaX
      if (this.dragAccumulatedX > this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('left')
      } else if (this.dragAccumulatedX < -this.dragSwitchThreshold) {
        this.dragAccumulatedX = 0
        this.switchToNextTarget('right')
      }
      event.preventDefault()
    } else if (!this.inTreeHub) {
      this.sceneDragOffsetX += deltaX * this.sceneDragStrength * 0.01
      this.sceneDragOffsetY += deltaY * this.sceneDragStrength * 0.01
      this.sceneDragOffsetX = THREE.MathUtils.clamp(this.sceneDragOffsetX, -this.sceneDragMax, this.sceneDragMax)
      this.sceneDragOffsetY = THREE.MathUtils.clamp(this.sceneDragOffsetY, -this.sceneDragMax, this.sceneDragMax)
      event.preventDefault()
    }

    this.previousMouseX = x
    this.previousMouseY = y
  }

  onTouchEnd(event) {
    if (event.touches.length === 0) {
      this.isDragging = false
      this._touchGesture = null
      this._touchPinchLastDist = 0
      this._touchForestWalkAccum = 0
      this._touchTreeHubAccum = 0
    }
    if (event.touches.length === 1 && this._touchGesture === 'pinch') {
      this._touchGesture = 'undecided'
      this._touchPinchLastDist = 0
      const t = event.touches[0]
      this._touchStartX = t.clientX
      this._touchStartY = t.clientY
      this.previousMouseX = t.clientX
      this.previousMouseY = t.clientY
      this.isDragging = true
    }
  }

  onWheel(event) {
    if (this.shouldIgnoreWheelScrollTarget(event.target)) return

    event.preventDefault()
    this.applyWheelLikeDelta(event.deltaY, event)
  }

  handleTreeHubScroll(deltaY) {
    if (this.exitConfirmationShown || this.isSceneTransitioning) return
    if (Math.abs(deltaY) < this.treeHubScrollDeadzone) return

    const forward = new THREE.Vector3()
    forward.subVectors(this.targets.front.position, this.startPosition).normalize()
    const toPos = new THREE.Vector3().subVectors(this.position, this.startPosition)
    const currentDist = toPos.dot(forward)
    const revealStart = this.treeHubDistanceFromStart
    const returnDist = this.treeHubReturnDistanceFromStart
    const lookAt = this.targets.front.position.clone()

    const scrollIntent = Math.sign(deltaY) * this.treeHubForwardScrollSign

    // Forward scroll is disabled in tree hub.
    if (scrollIntent > 0) {
      return
    }

    // Backward scroll: move from landing to halfway return point, fading out controls.
    if (currentDist > returnDist) {
      const nextDist = Math.max(currentDist - this.treeHubScrollStep, returnDist)
      const nextPos = this.startPosition.clone().add(forward.clone().multiplyScalar(nextDist))
      nextPos.y = getWalkEyeWorldY()
      this.position.copy(nextPos)
      this.targetPosition.copy(nextPos)
      this.camera.walkPosition.copy(nextPos)
      this.camera.walkLookAtTarget = lookAt
      const fadeProgress = THREE.MathUtils.clamp((nextDist - returnDist) / (revealStart - returnDist), 0, 1)
      this.experience.sections?.setTreeHubControlsProgress(fadeProgress)
      if (nextDist <= returnDist + 0.001) {
        this.showExitConfirmation()
      }
      return
    }

    // At halfway return point, ask confirmation in place.
    this.showExitConfirmation()
  }

  onKeyDown(event) {
    if (this.exitConfirmationShown) return

    if (event.key === 'Escape' && this.livestreamInfoOpen) {
      this.closeLivestreamInfoModal()
      return
    }

    if (this.experience.phase === 'forest' && !this.isSceneTransitioning && this.currentTarget === 'front') {
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
      finalNavPosition.y = this.getEyeYForScene(newTarget)
      
      // The camera end position IS the final nav position (walk mode copies position directly)
      const endCamPos = finalNavPosition.clone()
      // The camera end lookAt IS the target object position
      const endLookAt = this.getSceneLookAt(targetObj.position.clone(), newTarget)
      
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

          if (newTarget !== 'right') {
            this.closeLivestreamInfoModal()
          }

          // Adjust mouse look per scene
          if (newTarget === 'left') {
            this.mouseLookStrength = this.panelTalkMouseLookStrength
          } else if (newTarget === 'right') {
            this.mouseLookStrength = this.livestreamMouseLookStrength
          } else {
            this.mouseLookStrength = this.defaultMouseLookStrength
          }
          if (newTarget !== 'left') this.clearPanelTalkStops()

          // For Panel Talk / Livestream: show welcome popup immediately
          if (newTarget === 'left' || newTarget === 'right') {
            this.showSceneWelcome(newTarget)
          } else {
            // Returning to front — restore forest UI
            this.inScene = false
            this.showForestHint()
            this.setNavButtonsVisible(true)
            this.updateNavArrows()
          }
        }
      })
    }
  }

  update() {
    this.refreshExitToForestButton()
    this.refreshLivestreamInfoButton()
    this.refreshPanelProgressVisibility()
    if (!this.enabled) return
    
    if (this.experience.phase === 'forest' || this.inTreeHub) {
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
    if (Math.abs(this.moveVelocity) > 0.001 && !this.inTreeHub && !this.exitConfirmationShown && !this.welcomeShown && !this.exhibitionOverviewShown && !this.isSceneTransitioning) {
      const currentTargetObj = this.targets[this.currentTarget]
      const forward = new THREE.Vector3()
      forward.subVectors(currentTargetObj.position, this.startPosition).normalize()
      
      // Calculate new position
      const newPosition = this.position.clone().add(forward.clone().multiplyScalar(this.moveVelocity))
      
      // Calculate distance from start along the target direction
      const toNewPos = new THREE.Vector3().subVectors(newPosition, this.startPosition)
      const distanceFromStart = toNewPos.dot(forward)  // Project onto forward direction
      
      // Calculate distance to target object
      const targetPos2D = new THREE.Vector3(currentTargetObj.position.x, getWalkEyeWorldY(), currentTargetObj.position.z)
      const distanceToTarget = newPosition.distanceTo(targetPos2D)
      
      if (this.currentTarget === 'left') {
        // Panel Talk uses discrete stop-based navigation on wheel.
        this.moveVelocity = 0
      } else if (this.currentTarget !== 'front') {
        // Panel Talk / Livestream scene — scroll to navigate within scene
        if (!this.inScene) {
          // Not yet entered scene, block scrolling
          this.moveVelocity = 0
          return
        }
        
        // Exit only when scrolling backward toward the forest. Landing uses walk eye height while `forward`
        // includes a Y component, so projection along `forward` is slightly below `approachDistance`;
        // treating "<= approachDistance" without a sign check made forward scroll open exit too.
        const atEntryBand = distanceFromStart <= this.approachDistance + 0.08
        if (atEntryBand && this.moveVelocity < 0) {
          this.position.copy(this.startPosition.clone().add(forward.clone().multiplyScalar(this.approachDistance)))
          this.position.y = getWalkEyeWorldY()
          this.targetPosition.copy(this.position)
          this.moveVelocity = 0
          this.showExitConfirmation()
        } else {
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
          this.position.y = getWalkEyeWorldY()
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

    // Keep at eye height (startPosition Y stays in sync for distance / tree hub math)
    const eyeY = this.getEyeYForScene(this.currentTarget)
    this.startPosition.y = eyeY
    this.position.y = eyeY
    this.targetPosition.y = eyeY

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
    const lockPanelFraming = this.currentTarget === 'left' && this.inScene && this.panelStops.length > 0
    const lockTreeHubLanding = this.inTreeHub && performance.now() < this.treeHubLookLockUntil
    const lockLookFraming = lockPanelFraming || lockTreeHubLanding
    const mouseLookOffsetX = lockLookFraming ? 0 : (this.currentMouseX * this.mouseLookStrength + this.sceneDragOffsetX)
    const mouseLookOffsetY = lockLookFraming ? 0 : (-this.currentMouseY * this.mouseLookStrength + this.sceneDragOffsetY)  // Invert Y

    // Get current target position for look-at (keeps object centered)
    const currentTargetObj = this.targets[this.currentTarget]
    const lookAtTarget = this.currentTarget === 'left' && this.panelLookAtOverride
      ? this.panelLookAtOverride.clone()
      : new THREE.Vector3(
        currentTargetObj.position.x,
        currentTargetObj.position.y,
        currentTargetObj.position.z
      )

    // Update camera with mouse look and look-at target
    this.camera.updateWalkPosition(this.position, this.rotationY, mouseLookOffsetX, mouseLookOffsetY, lookAtTarget)

    if (this.inTreeHub && this.experience.phase === 'tree') {
      this.experience.sections?.updateScroll(this.treeLandingScrollProgress)
    }

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
    this.closeLivestreamInfoModal()
    this.position.copy(this.startPosition)
    this.targetPosition.copy(this.startPosition)
    this.rotationY = 0
    this.targetRotationY = 0
    this.moveVelocity = 0
    this.currentTarget = 'front'
    this.previousTarget = 'front'
    this.inScene = false
    this.exitTreeHub()
    this.clearPanelTalkStops()
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
