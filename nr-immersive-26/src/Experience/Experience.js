import * as THREE from 'three'
import gsap from 'gsap'

import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Resources from './Utils/Resources.js'
import Debug from './Utils/Debug.js'

import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import Navigation from './Navigation.js'
import Sections from './Sections.js'
import VideoPopup from './VideoPopup.js'

import sources from './sources.js'
import { WORLD_GROUND_LEVEL_Y, getWalkEyeWorldY } from './World/worldGroundLevel.js'

/** When `true`, skip ticket + landing and start in the forest. Set `false` for the normal welcome page. */
const SKIP_LANDING_PAGE = false

let instance = null

export default class Experience {
  constructor(canvas) {
    if (instance) return instance
    instance = this

    this.canvas = canvas

    this.debug = new Debug()
    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()
    this.resources = new Resources(sources)
    this.camera = new Camera()
    this.renderer = new Renderer()
    this.world = new World()
    this.navigation = new Navigation()
    this.sections = new Sections()
    this.videoPopup = new VideoPopup()

    this.phase = 'landing'
    this.isTransitioning = false

    /** Pre-upload posters + pre-compile side-stage shaders so the first swing does not hitch. */
    this._sideStageShaderWarmupFallbackId = null
    this._sideStageWarmupDebounceId = null
    this._sideStageWarmupRunning = false
    this._sideStageWarmupPending = false

    this.loadingScreen = document.querySelector('.loading-screen')
    this.forestHint = document.querySelector('.forest-hint')
    this.landingPage = document.querySelector('.landing-page')
    this.logoButton = document.querySelector('.top-bar-logo')

    // Disable navigation until the user passes the welcome page (Enter + valid code)
    this.navigation.enabled = false

    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())

    this.resources.on('ready', () => {
      this.hideLoadingScreen()
    })
    if (this.resources.toLoad === 0) {
      setTimeout(() => {
        this.hideLoadingScreen()
      }, 500)
    }

    this.setupLandingPage()
    this.setupLogoNavigation()
  }

  setupLogoNavigation() {
    if (!this.logoButton) return
    this.logoButton.style.cursor = 'pointer'
    this.logoButton.addEventListener('click', () => this.onLogoClick())
  }

  onLogoClick() {
    // If user hasn't passed welcome yet, stay on welcome page.
    if (this.phase === 'landing') return
    if (this.isTransitioning) return

    // Tree phase already has a dedicated transition back.
    if (this.phase === 'tree') {
      this.transitionToForest()
      return
    }

    // Forest phase: return to the forest landing position smoothly.
    if (this.phase === 'forest') {
      this.returnToForestLanding()
    }
  }

  returnToForestLanding() {
    if (this.isTransitioning) return
    this.isTransitioning = true

    // If currently in side scene, notify world to pause scene content.
    if (this.navigation.currentTarget !== 'front' && this.world?.onExitScene) {
      this.world.onExitScene(this.navigation.currentTarget)
    }

    // Hide any blocking overlays before transition.
    if (this.navigation?.hideExitConfirmation) this.navigation.hideExitConfirmation()
    if (this.navigation?.sceneWelcome) this.navigation.sceneWelcome.classList.remove('is-visible')
    if (this.navigation?.closeLivestreamInfoModal) this.navigation.closeLivestreamInfoModal()

    const endCamPos = this.navigation.startPosition.clone()
    const endLookAt = this.navigation.targets.front.position.clone()
    const startCamPos = this.camera.instance.position.clone()
    const startLookAt = this.navigation.targets[this.navigation.currentTarget]?.position?.clone() || endLookAt.clone()

    this.camera.mode = 'transitioning'
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2,
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(look)
      },
      onComplete: () => {
        this.navigation.resetToStart()
        this.navigation.enabled = true
        this.camera.walkPosition.copy(endCamPos)
        this.camera.walkLookAtTarget = endLookAt.clone()
        this.camera.setWalkMode()
        this.isTransitioning = false
      }
    })
  }

  setupLandingPage() {
    // Ticket code validation
    this.validTicketCode = 'NR26'
    this.ticketInput = document.getElementById('ticket-code-input')
    this.enterBtn = document.getElementById('enter-btn')
    
    if (this.ticketInput) {
      this.ticketInput.addEventListener('input', () => this.validateTicketCode())
      this.ticketInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && this.isTicketValid) {
          this.enterExperience()
        }
      })
    }

    // Enter button
    if (this.enterBtn) {
      this.enterBtn.addEventListener('click', () => {
        if (this.isTicketValid) {
          this.enterExperience()
        }
      })
    }
    
    this.isTicketValid = false

    // Countdown timer — April 11, 2026 at 10:00 AM PST (UTC-8)
    this.countdownTarget = new Date('2026-04-11T18:00:00Z')
    
    this.countdownElement = document.getElementById('countdown-timer')
    this.countdownInterval = null
    this._livestreamCountdownExpiredApplied = false
    this.updateCountdown()
    this.countdownInterval = setInterval(() => this.updateCountdown(), 1000)
  }

  /** When target time passes: hide numeric countdown; label → “Livestream / Main Stage”. */
  applyLivestreamCountdownExpired() {
    if (this._livestreamCountdownExpiredApplied) return
    this._livestreamCountdownExpiredApplied = true

    const center = document.querySelector('.top-bar-center')
    center?.classList.add('countdown-expired')

    document.querySelectorAll('.center-countdown .center-label').forEach((el) => {
      el.innerHTML = 'Livestream<br>Main Stage'
    })
  }

  validateTicketCode() {
    if (!this.ticketInput || !this.enterBtn) return
    
    const code = this.ticketInput.value.toUpperCase().trim()
    
    // Remove previous states
    this.ticketInput.classList.remove('valid', 'invalid')
    
    if (code === '') {
      this.isTicketValid = false
      this.enterBtn.disabled = true
      return
    }
    
    if (code === this.validTicketCode) {
      this.ticketInput.classList.add('valid')
      this.isTicketValid = true
      this.enterBtn.disabled = false
    } else if (code.length >= this.validTicketCode.length) {
      this.ticketInput.classList.add('invalid')
      this.isTicketValid = false
      this.enterBtn.disabled = true
    } else {
      this.isTicketValid = false
      this.enterBtn.disabled = true
    }
  }

  updateCountdown() {
    const slots = document.querySelectorAll('.top-bar-center .countdown-time')
    if (!slots.length && !this.countdownElement) return

    const now = new Date()
    const diff = this.countdownTarget - now

    const apply = (text) => {
      slots.forEach((el) => {
        el.textContent = text
      })
      if (!slots.length && this.countdownElement) {
        this.countdownElement.textContent = text
      }
    }

    if (diff <= 0) {
      this.applyLivestreamCountdownExpired()
      if (this.countdownInterval != null) {
        clearInterval(this.countdownInterval)
        this.countdownInterval = null
      }
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    const hh = hours.toString().padStart(2, '0')
    const mm = minutes.toString().padStart(2, '0')
    const ss = seconds.toString().padStart(2, '0')

    const text =
      days >= 1 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`
    apply(text)
  }

  enterExperience() {
    if (this.isTransitioning) return
    if (this.phase !== 'landing') return
    
    this.isTransitioning = true
    
    document.body.classList.remove('phase-landing')
    document.body.classList.add('phase-forest')

    // Get start position from navigation
    const startPosition = this.navigation.startPosition.clone()
    
    // Walk mode will look at the default target (front/tree)
    const walkLookAt = this.navigation.targets[this.navigation.currentTarget].position.clone()
    
    // Starting lookAt for overhead view
    const overheadLookAt = new THREE.Vector3(0, 5, -15)
    
    // Capture the camera's actual current position (may have drifted from landing orbit)
    const transitionStartPos = this.camera.instance.position.clone()
    
    // Stop the landing mode update from fighting with the GSAP animation
    this.camera.mode = 'transitioning'
    
    // Animate camera from overhead to forest walk position
    const transitionProgress = { value: 0 }
    gsap.to(transitionProgress, {
      value: 1,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = transitionProgress.value
        
        // Interpolate camera position from current to walk start
        this.camera.instance.position.lerpVectors(
          transitionStartPos, startPosition, t
        )
        
        // Interpolate look-at target from overhead center to walk target
        const lookTarget = new THREE.Vector3().lerpVectors(overheadLookAt, walkLookAt, t)
        this.camera.instance.lookAt(lookTarget)
      },
      onComplete: () => {
        // Ensure final state exactly matches walk mode
        this.camera.instance.position.copy(startPosition)
        this.camera.instance.lookAt(walkLookAt)
        
        this.phase = 'forest'
        this.camera.setWalkMode()
        this.navigation.enabled = true
        this.isTransitioning = false

        this.scheduleSideStageShaderWarmupFallback()
      }
    })
  }

  /**
   * Push a decoded poster to the GPU early so the first in-frustum draw does not upload it synchronously.
   */
  warmupSideStagePosterTexture(texture) {
    const r = this.renderer?.instance
    if (!texture || !r?.initTexture) return
    try {
      r.initTexture(texture)
    } catch {
      /* ignore */
    }
  }

  /**
   * Debounced shader pre-compile from Panel Talk / Livestream approach angles.
   * Runs again if a second poster finishes while a pass is still running.
   */
  kickSideStageShaderWarmup() {
    if (this._sideStageWarmupDebounceId != null) {
      clearTimeout(this._sideStageWarmupDebounceId)
    }
    this._sideStageWarmupDebounceId = setTimeout(() => {
      this._sideStageWarmupDebounceId = null
      void this.runSideStageShaderWarmup()
    }, 120)
  }

  /**
   * If posters are slow, still compile once after idle (throwaway camera; does not move the user camera).
   */
  scheduleSideStageShaderWarmupFallback() {
    if (this._sideStageShaderWarmupFallbackId != null) return
    this._sideStageShaderWarmupFallbackId = setTimeout(() => {
      this._sideStageShaderWarmupFallbackId = null
      this.kickSideStageShaderWarmup()
    }, 2500)
  }

  async runSideStageShaderWarmup() {
    if (this._sideStageWarmupRunning) {
      this._sideStageWarmupPending = true
      return
    }
    this._sideStageWarmupRunning = true
    this._sideStageWarmupPending = false

    const r = this.renderer?.instance
    const nav = this.navigation
    const mainCam = this.camera?.instance

    try {
      if (!r || !nav || !mainCam) return

      const wCam = new THREE.PerspectiveCamera(
        mainCam.fov,
        mainCam.aspect,
        mainCam.near,
        mainCam.far
      )

      const compileView = r.compileAsync
        ? (cam) => r.compileAsync(this.scene, cam)
        : (cam) => {
            r.compile(this.scene, cam)
            return Promise.resolve()
          }

      for (const key of ['left', 'right']) {
        const targetObj = nav.targets[key]
        const dir = new THREE.Vector3()
          .subVectors(targetObj.position, nav.startPosition)
          .normalize()
        const pos = nav.startPosition.clone().add(dir.multiplyScalar(nav.approachDistance))
        pos.y = getWalkEyeWorldY()
        wCam.position.copy(pos)
        wCam.lookAt(targetObj.position)
        wCam.updateMatrixWorld(true)
        await compileView(wCam)
      }
    } finally {
      this._sideStageWarmupRunning = false
      if (this._sideStageWarmupPending) void this.runSideStageShaderWarmup()
    }
  }

  hideLoadingScreen() {
    document.body.classList.remove('app-booting')
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('is-hidden')
    }
    this.applySkipLandingPageIfEnabled()
  }

  /**
   * Skip welcome/landing: same end state as `enterExperience()` onComplete (forest walk, no GSAP).
   */
  applySkipLandingPageIfEnabled() {
    if (!SKIP_LANDING_PAGE) return
    if (this.phase !== 'landing') return

    document.body.classList.remove('phase-landing')
    document.body.classList.add('phase-forest')
    this.phase = 'forest'

    const nav = this.navigation
    const walkLookAt = nav.targets[nav.currentTarget].position.clone()
    const startPosition = nav.startPosition.clone()

    this.camera.instance.position.copy(startPosition)
    this.camera.instance.lookAt(walkLookAt)
    this.camera.walkPosition.copy(startPosition)
    this.camera.walkLookAtTarget = walkLookAt.clone()
    this.camera.setWalkMode()

    nav.enabled = true
    nav.showForestHint()
    nav.setNavButtonsVisible(true)
    nav.updateTopBarCenter('default')
    nav.updateNavArrows()

    this.scheduleSideStageShaderWarmupFallback()
  }

  resize() {
    this.camera.resize()
    this.renderer.resize()
  }

  update() {
    this.navigation.update()
    this.camera.update()
    this.world.update()
    this.renderer.update()
  }

  transitionToTree(startScrollProgress = 0.5) {
    if (this.phase === 'tree' || this.isTransitioning) return
    
    this.isTransitioning = true
    this.phase = 'tree'

    document.body.classList.add('phase-tree')
    document.body.classList.remove('phase-forest')
    
    // Hide forest UI
    this.navigation.setNavButtonsVisible(false)
    if (this.navigation.forestHint) {
      this.navigation.forestHint.classList.add('is-hidden')
    }
    
    // Update top bar center to show Gallery (tree crown)
    this.navigation.updateTopBarCenter('front')

    // Straight move toward main tree, keep current forward-facing view (no orbit rotation)
    const treeForward = new THREE.Vector3()
      .subVectors(this.navigation.targets.front.position, this.navigation.startPosition)
      .normalize()
    const startCamPos = this.camera.instance.position.clone()
    const endCamPos = this.navigation.startPosition.clone().add(
      treeForward.multiplyScalar(this.navigation.treeHubDistanceFromStart)
    )
    endCamPos.y = getWalkEyeWorldY()
    const startLookAt = this.navigation.targets.front.position.clone()
    const endLookAt = this.navigation.targets.front.position.clone()

    this.camera.mode = 'transitioning'
    
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2.8,
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(look)
      },
      onComplete: () => {
        // Keep tree progress state but remain in walk mode (tree hub)
        this.camera.scrollProgress = startScrollProgress
        this.navigation.scrollProgress = startScrollProgress
        this.navigation.targetScrollProgress = startScrollProgress
        this.navigation.enterTreeHub(endCamPos, endLookAt)
        this.camera.setWalkMode()
        this.sections.showTreeHub()
        this.isTransitioning = false
      }
    })
  }

  transitionToForest() {
    if (this.phase === 'forest' || this.isTransitioning) return
    
    this.isTransitioning = true
    this.phase = 'forest'

    document.body.classList.remove('phase-tree', 'phase-exhibition-orbit', 'phase-showcase-orbit')
    document.body.classList.add('phase-forest')
    
    // Update top bar center to show countdown
    this.navigation.updateTopBarCenter('default')

    const startCamPos = this.camera.instance.position.clone()
    const treeZ = this.camera.treePosition.z
    const gy = WORLD_GROUND_LEVEL_Y
    let startLookAt = new THREE.Vector3(0, this.camera.focusLookAtHeight + gy, treeZ)
    if (this.camera.mode === 'exhibitionOrbit') {
      startLookAt.set(this.camera.treePosition.x, this.camera.exhibitionLookAtHeight + gy, treeZ)
    } else if (this.camera.mode === 'showcaseOrbit') {
      startLookAt.set(this.camera.treePosition.x, this.camera.showcaseLookAtHeight + gy, treeZ)
    }

    this.sections.hide({ skipOrbitCameraReset: true, skipTreeBodyPhase: true })

    if (this.world?.exhibitionNodes) this.world.exhibitionNodes.hide()
    if (this.world?.showcaseNodes) this.world.showcaseNodes.hide()

    const endCamPos = this.navigation.startPosition.clone()
    const endLookAt = this.navigation.targets.front.position.clone()

    this.camera.mode = 'transitioning'
    
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(look)
      },
      onComplete: () => {
        this.navigation.resetToStart()
        this.navigation.enabled = true
        this.camera.walkPosition.copy(endCamPos)
        this.camera.walkLookAtTarget = endLookAt.clone()
        this.camera.setWalkMode()
        this.isTransitioning = false
      }
    })
  }

  dispose() {
    if (this._sideStageShaderWarmupFallbackId != null) {
      clearTimeout(this._sideStageShaderWarmupFallbackId)
      this._sideStageShaderWarmupFallbackId = null
    }
    if (this._sideStageWarmupDebounceId != null) {
      clearTimeout(this._sideStageWarmupDebounceId)
      this._sideStageWarmupDebounceId = null
    }

    this.sizes.off('resize')
    this.time.off('tick')

    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        for (const key in child.material) {
          const value = child.material[key]
          if (value && typeof value.dispose === 'function') {
            value.dispose()
          }
        }
      }
    })

    this.camera.dispose()
    this.renderer.dispose()
    
    if (this.debug.active) this.debug.dispose()

    instance = null
  }
}
