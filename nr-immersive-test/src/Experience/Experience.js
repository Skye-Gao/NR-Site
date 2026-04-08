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

    this.loadingScreen = document.querySelector('.loading-screen')
    this.forestHint = document.querySelector('.forest-hint')
    this.landingPage = document.querySelector('.landing-page')

    // Hide landing page UI immediately
    if (this.landingPage) {
      this.landingPage.style.display = 'none'
    }

    // Disable navigation during camera transition
    this.navigation.enabled = false

    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())

    this.resources.on('ready', () => {
      this.hideLoadingScreen()
      this.enterExperience()
    })
    if (this.resources.toLoad === 0) {
      setTimeout(() => {
        this.hideLoadingScreen()
        this.enterExperience()
      }, 500)
    }

    this.setupLandingPage()
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
    this.updateCountdown()
    this.countdownInterval = setInterval(() => this.updateCountdown(), 1000)
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
    if (!this.countdownElement) return
    
    const now = new Date()
    const diff = this.countdownTarget - now
    
    if (diff <= 0) {
      this.countdownElement.textContent = '00:00:00'
      clearInterval(this.countdownInterval)
      return
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    const hh = hours.toString().padStart(2, '0')
    const mm = minutes.toString().padStart(2, '0')
    const ss = seconds.toString().padStart(2, '0')
    
    this.countdownElement.textContent = days >= 1
      ? `${days}d ${hh}:${mm}:${ss}`
      : `${hh}:${mm}:${ss}`
  }

  enterExperience() {
    if (this.isTransitioning) return
    if (this.phase !== 'landing') return
    
    this.isTransitioning = true
    
    document.body.classList.remove('phase-landing')
    document.body.classList.add('phase-forest')
    
    if (this.landingPage) {
      this.landingPage.style.display = 'none'
    }
    
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
      }
    })
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('is-hidden')
    }
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
    
    // Update top bar center to show "Exhibition"
    this.navigation.updateTopBarCenter('front')

    // Calculate camera target from the scroll progress landing position
    const treeZ = -60
    const cam = this.camera
    const landingHeight = THREE.MathUtils.lerp(cam.focusMinHeight, cam.focusMaxHeight, startScrollProgress)
    const landingRadius = THREE.MathUtils.lerp(cam.focusMinOrbitRadius, cam.focusMaxOrbitRadius, startScrollProgress)
    const landingLookAtHeight = THREE.MathUtils.lerp(
      cam.focusMinLookAtHeight,
      cam.focusMaxHeight * cam.focusLookAtRatio,
      startScrollProgress
    )
    
    const orbitAngle = cam.focusOrbitAngle
    const targetX = Math.sin(orbitAngle) * landingRadius
    const targetZ = treeZ + Math.cos(orbitAngle) * landingRadius
    
    const startCamPos = this.camera.instance.position.clone()
    const endCamPos = new THREE.Vector3(targetX, landingHeight, targetZ)
    const startLookAt = this.navigation.targets.front.position.clone()
    const endLookAt = new THREE.Vector3(0, landingLookAtHeight, treeZ)

    this.camera.mode = 'transitioning'
    
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = progress.value
        this.camera.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        this.camera.instance.lookAt(look)
      },
      onComplete: () => {
        // Set scroll progress to the landing position
        this.camera.scrollProgress = startScrollProgress
        this.navigation.scrollProgress = startScrollProgress
        this.navigation.targetScrollProgress = startScrollProgress
        
        this.camera.setFocusMode()
        this.sections.show(startScrollProgress)
        this.isTransitioning = false
      }
    })
  }

  transitionToForest() {
    if (this.phase === 'forest' || this.isTransitioning) return
    
    this.isTransitioning = true
    this.phase = 'forest'

    document.body.classList.remove('phase-tree')
    document.body.classList.add('phase-forest')
    
    // Update top bar center to show countdown
    this.navigation.updateTopBarCenter('default')

    this.sections.hide()

    const startCamPos = this.camera.instance.position.clone()
    const endCamPos = this.navigation.startPosition.clone()
    const startLookAt = new THREE.Vector3(0, this.camera.focusLookAtHeight, -60)
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
        this.camera.walkPosition.copy(endCamPos)
        this.camera.walkLookAtTarget = endLookAt.clone()
        this.camera.setWalkMode()
        this.isTransitioning = false
      }
    })
  }

  dispose() {
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
