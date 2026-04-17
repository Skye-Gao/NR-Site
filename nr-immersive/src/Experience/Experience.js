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

    // Disable navigation during landing phase
    this.navigation.enabled = false

    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())

    this.resources.on('ready', () => this.hideLoadingScreen())
    if (this.resources.toLoad === 0) {
      setTimeout(() => this.hideLoadingScreen(), 500)
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
    if (this.phase !== 'landing' || this.isTransitioning) return
    
    this.isTransitioning = true
    
    document.body.classList.remove('phase-landing')
    document.body.classList.add('phase-forest')
    
    // Get start position from navigation
    const startPosition = this.navigation.startPosition.clone()
    
    // Animate camera from overhead to forest walk position
    gsap.to(this.camera.instance.position, {
      x: startPosition.x,
      y: startPosition.y,
      z: startPosition.z,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        // Gradually shift look target from above to forward
        const currentY = this.camera.instance.position.y
        const startHeight = 45
        const normalizedProgress = 1 - (currentY - startPosition.y) / (startHeight - startPosition.y)
        
        const lookY = THREE.MathUtils.lerp(5, startPosition.y, normalizedProgress)
        const lookZ = THREE.MathUtils.lerp(-15, startPosition.z - 10, normalizedProgress)
        
        this.camera.instance.lookAt(0, lookY, lookZ)
      },
      onComplete: () => {
        this.phase = 'forest'
        this.camera.setWalkMode()
        this.navigation.enabled = true
        this.isTransitioning = false
        
        // Forest hint visibility is handled by CSS based on phase class
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

  transitionToTree() {
    if (this.phase === 'tree' || this.isTransitioning) return
    
    this.isTransitioning = true
    this.phase = 'tree'

    document.body.classList.add('phase-tree')
    document.body.classList.remove('phase-forest')
    // Forest hint visibility is handled by CSS based on phase class
    
    // Update top bar center to show "Exhibition"
    this.navigation.updateTopBarCenter('front')

    // Tree is at z = -60, orbit around it
    const treeZ = -60
    const targetPosition = { x: 0, y: 5, z: treeZ + this.camera.focusOrbitRadius }

    gsap.to(this.camera.instance.position, {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      duration: 2,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.instance.lookAt(0, 5, treeZ)
      },
      onComplete: () => {
        this.camera.setFocusMode()
        this.sections.show()
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

    // Reset navigation to start position
    this.navigation.resetToStart()
    const startPosition = this.navigation.startPosition.clone()

    gsap.to(this.camera.instance.position, {
      x: startPosition.x,
      y: startPosition.y,
      z: startPosition.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onComplete: () => {
        this.camera.setWalkMode()
        this.isTransitioning = false
        // Forest hint visibility is handled by CSS based on phase class
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
