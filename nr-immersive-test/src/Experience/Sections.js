import * as THREE from 'three'
import gsap from 'gsap'
import Experience from './Experience.js'

export default class Sections {
  constructor() {
    this.experience = new Experience()

    this.sections = [
      { id: 'showcase', range: [0, 0.5], element: null },    // Bottom - Special Showcase
      { id: 'exhibition', range: [0.5, 1], element: null },  // Top - Exhibition
    ]

    this.currentSection = null
    this.visible = false
    
    // Exhibition (top) tracking
    this.exhibitionEntryShown = false
    this.inExhibitionOrbit = false
    
    // Showcase (bottom) tracking
    this.showcaseEntryShown = false
    this.inShowcaseOrbit = false

    this.setElements()
  }

  setElements() {
    this.sections.forEach((section) => {
      section.element = document.querySelector(`.section-${section.id}`)
    })
    
    this.container = document.querySelector('.sections-container')
    this.scrollThumb = document.querySelector('.scroll-thumb')
    this.scrollTrack = document.querySelector('.scroll-track')

    this.backButton = document.querySelector('.back-button')
    if (this.backButton) {
      this.backButton.addEventListener('click', () => {
        this.returnToTreeLanding()
      })
    }
    
    // Exhibition entry popup elements
    this.exhibitionEntry = document.getElementById('exhibition-entry')
    this.exhibitionEntryBtn = document.getElementById('exhibition-entry-btn')
    
    if (this.exhibitionEntryBtn) {
      this.exhibitionEntryBtn.addEventListener('click', () => {
        this.enterExhibitionOrbit()
      })
    }
    
    // Showcase entry popup elements
    this.showcaseEntry = document.getElementById('showcase-entry')
    this.showcaseEntryBtn = document.getElementById('showcase-entry-btn')
    
    if (this.showcaseEntryBtn) {
      this.showcaseEntryBtn.addEventListener('click', () => {
        this.enterShowcaseOrbit()
      })
    }
  }

  show(startScrollProgress = 0.5) {
    this.visible = true
    this.exhibitionEntryShown = false
    this.inExhibitionOrbit = false
    this.showcaseEntryShown = false
    this.inShowcaseOrbit = false
    if (this.container) {
      this.container.classList.add('is-visible')
    }
    this.updateScroll(startScrollProgress)
  }

  hide() {
    this.visible = false
    this.exitExhibitionOrbit()
    this.exitShowcaseOrbit()
    if (this.container) {
      this.container.classList.remove('is-visible')
    }
    this.sections.forEach((section) => {
      if (section.element) {
        section.element.classList.remove('is-active')
      }
    })
    this.currentSection = null
    this.hideExhibitionEntry()
    this.hideShowcaseEntry()
  }
  
  showExhibitionEntry() {
    if (this.exhibitionEntry && !this.exhibitionEntryShown) {
      this.exhibitionEntry.classList.add('is-visible')
      this.exhibitionEntryShown = true
      
      // Disable navigation while popup is shown
      if (this.experience.navigation) {
        this.experience.navigation.enabled = false
      }
    }
  }
  
  hideExhibitionEntry() {
    if (this.exhibitionEntry) {
      this.exhibitionEntry.classList.remove('is-visible')
    }
  }
  
  enterExhibitionOrbit() {
    this.hideExhibitionEntry()
    this.inExhibitionOrbit = true
    
    // Hide the sections UI to give more space
    if (this.container) {
      this.container.classList.add('exhibition-orbit-mode')
    }
    
    // Update body class for cursor
    document.body.classList.remove('phase-tree')
    document.body.classList.add('phase-exhibition-orbit')
    
    // Set camera to exhibition orbit mode
    if (this.experience.camera) {
      this.experience.camera.setExhibitionOrbitMode()
    }
    
    // Enable navigation with new orbit controls
    if (this.experience.navigation) {
      this.experience.navigation.enabled = true
      this.experience.navigation.setExhibitionOrbitMode(true)
    }
  }
  
  exitExhibitionOrbit(skipCameraReset = false) {
    if (!this.inExhibitionOrbit) return
    
    this.inExhibitionOrbit = false
    
    // Show sections UI again
    if (this.container) {
      this.container.classList.remove('exhibition-orbit-mode')
    }
    
    // Update body class
    document.body.classList.remove('phase-exhibition-orbit')
    document.body.classList.add('phase-tree')
    
    // Return navigation orbit mode
    if (this.experience.navigation) {
      this.experience.navigation.setExhibitionOrbitMode(false)
    }
    
    if (!skipCameraReset) {
      const landing = this.experience.navigation?.treeLandingScrollProgress ?? 0.5
      if (this.experience.navigation) {
        this.experience.navigation.scrollProgress = landing
        this.experience.navigation.targetScrollProgress = landing
      }
      if (this.experience.camera) {
        this.experience.camera.scrollProgress = landing
        this.experience.camera.setFocusMode()
      }
    }
  }
  
  // Showcase (root section) methods
  showShowcaseEntry() {
    if (this.showcaseEntry && !this.showcaseEntryShown) {
      this.showcaseEntry.classList.add('is-visible')
      this.showcaseEntryShown = true
      
      // Disable navigation while popup is shown
      if (this.experience.navigation) {
        this.experience.navigation.enabled = false
      }
    }
  }
  
  hideShowcaseEntry() {
    if (this.showcaseEntry) {
      this.showcaseEntry.classList.remove('is-visible')
    }
  }
  
  enterShowcaseOrbit() {
    this.hideShowcaseEntry()
    this.inShowcaseOrbit = true
    
    // Hide the sections UI to give more space
    if (this.container) {
      this.container.classList.add('showcase-orbit-mode')
    }
    
    // Update body class for cursor
    document.body.classList.remove('phase-tree')
    document.body.classList.add('phase-showcase-orbit')
    
    // Hide floor for underground view
    if (this.experience.world?.floor) {
      this.experience.world.floor.hide()
    }
    
    // Show only underground roots
    if (this.experience.world?.mainTree) {
      this.experience.world.mainTree.showUndergroundOnly()
    }
    
    // Set camera to showcase orbit mode
    if (this.experience.camera) {
      this.experience.camera.setShowcaseOrbitMode()
    }
    
    // Enable navigation with new orbit controls
    if (this.experience.navigation) {
      this.experience.navigation.enabled = true
      this.experience.navigation.setShowcaseOrbitMode(true)
    }
  }
  
  exitShowcaseOrbit(skipCameraReset = false) {
    if (!this.inShowcaseOrbit) return
    
    this.inShowcaseOrbit = false
    
    // Show sections UI again
    if (this.container) {
      this.container.classList.remove('showcase-orbit-mode')
    }
    
    // Update body class
    document.body.classList.remove('phase-showcase-orbit')
    document.body.classList.add('phase-tree')
    
    // Show floor again when exiting underground
    if (this.experience.world?.floor) {
      this.experience.world.floor.show()
    }
    
    // Show above ground tree parts
    if (this.experience.world?.mainTree) {
      this.experience.world.mainTree.showAboveGroundOnly()
    }
    
    // Return navigation orbit mode
    if (this.experience.navigation) {
      this.experience.navigation.setShowcaseOrbitMode(false)
    }
    
    if (!skipCameraReset) {
      const landing = this.experience.navigation?.treeLandingScrollProgress ?? 0.5
      if (this.experience.navigation) {
        this.experience.navigation.scrollProgress = landing
        this.experience.navigation.targetScrollProgress = landing
      }
      if (this.experience.camera) {
        this.experience.camera.scrollProgress = landing
        this.experience.camera.setFocusMode()
      }
    }
  }

  returnToTreeLanding() {
    const wasInExhibition = this.inExhibitionOrbit
    const wasInShowcase = this.inShowcaseOrbit
    
    if (!wasInExhibition && !wasInShowcase) return
    
    const cam = this.experience.camera
    const nav = this.experience.navigation
    const landing = nav?.treeLandingScrollProgress ?? 0.5
    const treeZ = cam.treePosition.z
    
    // Calculate landing camera position from scroll progress
    const landingHeight = THREE.MathUtils.lerp(cam.focusMinHeight, cam.focusMaxHeight, landing)
    const landingRadius = THREE.MathUtils.lerp(cam.focusMinOrbitRadius, cam.focusMaxOrbitRadius, landing)
    const landingLookAtHeight = THREE.MathUtils.lerp(
      cam.focusMinLookAtHeight,
      cam.focusMaxHeight * cam.focusLookAtRatio,
      landing
    )
    const orbitAngle = cam.focusOrbitAngle
    const endX = Math.sin(orbitAngle) * landingRadius
    const endZ = treeZ + Math.cos(orbitAngle) * landingRadius
    
    const startCamPos = cam.instance.position.clone()
    const endCamPos = new THREE.Vector3(endX, landingHeight, endZ)
    const endLookAt = new THREE.Vector3(cam.treePosition.x, landingLookAtHeight, treeZ)
    
    // Determine start look-at from current orbit mode
    let startLookAt
    if (wasInExhibition) {
      startLookAt = new THREE.Vector3(cam.treePosition.x, cam.exhibitionLookAtHeight, treeZ)
    } else {
      startLookAt = new THREE.Vector3(cam.treePosition.x, cam.showcaseLookAtHeight, treeZ)
    }
    
    // Disable navigation during transition
    if (nav) nav.enabled = false
    cam.mode = 'transitioning'
    
    // Exit orbit state (restores floor, tree parts, body classes) but skip camera reset
    if (wasInExhibition) this.exitExhibitionOrbit(true)
    if (wasInShowcase) this.exitShowcaseOrbit(true)
    
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = progress.value
        cam.instance.position.lerpVectors(startCamPos, endCamPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        cam.instance.lookAt(look)
      },
      onComplete: () => {
        if (nav) {
          nav.scrollProgress = landing
          nav.targetScrollProgress = landing
          nav.enabled = true
        }
        cam.scrollProgress = landing
        cam.setFocusMode()
      }
    })
  }

  updateScroll(progress) {
    if (!this.visible || this.inExhibitionOrbit || this.inShowcaseOrbit) return

    if (this.scrollThumb && this.scrollTrack) {
      const trackHeight = this.scrollTrack.offsetHeight
      const thumbPosition = (1 - progress) * trackHeight
      this.scrollThumb.style.top = `${thumbPosition}px`
      this.scrollThumb.style.transform = 'translate(-50%, -50%)'
    }

    let activeSection = null
    for (const section of this.sections) {
      if (progress >= section.range[0] && progress < section.range[1]) {
        activeSection = section
        break
      }
    }
    
    if (progress >= 1) activeSection = this.sections[this.sections.length - 1]
    if (progress <= 0) activeSection = this.sections[0]

    if (activeSection && activeSection.id !== this.currentSection) {
      this.currentSection = activeSection.id

      this.sections.forEach((section) => {
        if (section.element) {
          section.element.classList.toggle('is-active', section.id === this.currentSection)
        }
      })
      
      // Show/hide exhibition nodes based on section
      if (this.experience.world?.exhibitionNodes) {
        if (this.currentSection === 'exhibition') {
          this.experience.world.exhibitionNodes.show()
        } else {
          this.experience.world.exhibitionNodes.hide()
        }
      }
      
      // Show/hide showcase nodes based on section
      if (this.experience.world?.showcaseNodes) {
        if (this.currentSection === 'showcase') {
          this.experience.world.showcaseNodes.show()
        } else {
          this.experience.world.showcaseNodes.hide()
        }
      }
      
      // Hide floor when underground (showcase), show when above ground (exhibition)
      if (this.experience.world?.floor) {
        if (this.currentSection === 'showcase') {
          this.experience.world.floor.hide()
        } else {
          this.experience.world.floor.show()
        }
      }
      
      // Show/hide tree model parts based on section
      if (this.experience.world?.mainTree) {
        if (this.currentSection === 'showcase') {
          this.experience.world.mainTree.showUndergroundOnly()
        } else {
          this.experience.world.mainTree.showAboveGroundOnly()
        }
      }
    }
    
    // Show exhibition entry popup when reaching the very top
    if (progress >= 0.98 && !this.exhibitionEntryShown && this.currentSection === 'exhibition') {
      this.showExhibitionEntry()
    }
    
    // Show showcase entry popup when reaching the very bottom
    if (progress <= 0.02 && !this.showcaseEntryShown && this.currentSection === 'showcase') {
      this.showShowcaseEntry()
    }
  }

  dispose() {}
}
