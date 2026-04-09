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
    this.orbitTransitioning = false

    this.setElements()
  }

  setElements() {
    this.sections.forEach((section) => {
      section.element = document.querySelector(`.section-${section.id}`)
    })
    
    this.container = document.querySelector('.sections-container')
    this.scrollThumb = document.querySelector('.scroll-thumb')
    this.scrollTrack = document.querySelector('.scroll-track')
    this.treeHubControls = document.getElementById('tree-hub-controls')
    this.treeHubExhibitionBtn = document.getElementById('tree-hub-exhibition-btn')
    this.treeHubShowcaseBtn = document.getElementById('tree-hub-showcase-btn')

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

    if (this.treeHubExhibitionBtn) {
      this.treeHubExhibitionBtn.addEventListener('click', () => {
        this.enterExhibitionOrbit()
      })
    }
    if (this.treeHubShowcaseBtn) {
      this.treeHubShowcaseBtn.addEventListener('click', () => {
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

  showTreeHub() {
    this.visible = true
    if (this.container) {
      this.container.classList.add('is-visible')
      this.container.classList.add('tree-hub-mode')
    }
    this.setTreeHubControlsProgress(1)
  }

  hideTreeHub() {
    if (this.container) this.container.classList.remove('tree-hub-mode')
    if (this.treeHubControls) {
      this.treeHubControls.classList.remove('is-visible')
      this.treeHubControls.style.opacity = ''
      this.treeHubControls.style.pointerEvents = ''
    }
  }

  setTreeHubControlsProgress(progress) {
    if (!this.treeHubControls) return
    const p = THREE.MathUtils.clamp(progress, 0, 1)
    if (p <= 0) {
      this.treeHubControls.classList.remove('is-visible')
      this.treeHubControls.style.opacity = ''
      this.treeHubControls.style.pointerEvents = 'none'
      return
    }
    this.treeHubControls.classList.add('is-visible')
    this.treeHubControls.style.opacity = `${p}`
    this.treeHubControls.style.pointerEvents = p >= 0.98 ? 'auto' : 'none'
  }

  hide() {
    this.visible = false
    this.hideTreeHub()
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
    if (this.orbitTransitioning) return
    if (this.experience.navigation?.inTreeHub) {
      this.transitionFromTreeHubToOrbit('exhibition')
      return
    }

    this.hideTreeHub()
    this.hideExhibitionEntry()
    this.inExhibitionOrbit = true
    this.experience.navigation?.exitTreeHub()
    
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

    // Ensure crown artworks are visible in this mode
    if (this.experience.world?.exhibitionNodes) {
      this.experience.world.exhibitionNodes.show()
    }
    if (this.experience.world?.showcaseNodes) {
      this.experience.world.showcaseNodes.hide()
    }
    if (this.experience.world?.mainTree) {
      this.experience.world.mainTree.showAboveGroundOnly()
    }
    if (this.experience.world?.floor) {
      this.experience.world.floor.show()
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
    if (this.orbitTransitioning) return
    if (this.experience.navigation?.inTreeHub) {
      this.transitionFromTreeHubToOrbit('showcase')
      return
    }

    this.hideTreeHub()
    this.hideShowcaseEntry()
    this.inShowcaseOrbit = true
    this.experience.navigation?.exitTreeHub()
    
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

    // Ensure root artworks are visible in this mode
    if (this.experience.world?.showcaseNodes) {
      this.experience.world.showcaseNodes.show()
    }
    if (this.experience.world?.exhibitionNodes) {
      this.experience.world.exhibitionNodes.hide()
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

  transitionFromTreeHubToOrbit(type) {
    const cam = this.experience.camera
    const nav = this.experience.navigation
    if (!cam || !nav) return

    this.orbitTransitioning = true
    nav.enabled = false
    nav.exitTreeHub()
    this.hideTreeHub()
    this.hideExhibitionEntry()
    this.hideShowcaseEntry()

    const treeZ = cam.treePosition.z
    const startPos = cam.instance.position.clone()
    const startLookAt = this.targetsLookAtFromMode(cam)

    let endPos
    let endLookAt
    if (type === 'exhibition') {
      const x = Math.sin(cam.exhibitionOrbitAngle) * cam.exhibitionOrbitRadius
      const z = treeZ + Math.cos(cam.exhibitionOrbitAngle) * cam.exhibitionOrbitRadius
      endPos = new THREE.Vector3(x, cam.exhibitionOrbitHeight, z)
      endLookAt = new THREE.Vector3(cam.treePosition.x, cam.exhibitionLookAtHeight, treeZ)
    } else {
      const x = Math.sin(cam.showcaseOrbitAngle) * cam.showcaseOrbitRadius
      const z = treeZ + Math.cos(cam.showcaseOrbitAngle) * cam.showcaseOrbitRadius
      endPos = new THREE.Vector3(x, cam.showcaseOrbitHeight, z)
      endLookAt = new THREE.Vector3(cam.treePosition.x, cam.showcaseLookAtHeight, treeZ)
    }

    cam.mode = 'transitioning'
    const progress = { value: 0 }
    gsap.to(progress, {
      value: 1,
      duration: 2.2,
      ease: 'sine.inOut',
      onUpdate: () => {
        const t = progress.value
        cam.instance.position.lerpVectors(startPos, endPos, t)
        const look = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, t)
        cam.instance.lookAt(look)
      },
      onComplete: () => {
        if (type === 'exhibition') {
          this.inExhibitionOrbit = true
          if (this.container) this.container.classList.add('exhibition-orbit-mode')
          document.body.classList.remove('phase-tree')
          document.body.classList.add('phase-exhibition-orbit')
          nav.setExhibitionOrbitMode(true)
          cam.setExhibitionOrbitMode()
          cam.exhibitionOrbitAngle = Math.atan2(endPos.x, endPos.z - treeZ)
          cam.exhibitionOrbitRadius = Math.hypot(endPos.x, endPos.z - treeZ)
          cam.exhibitionOrbitHeight = endPos.y

          // Crown mode visuals
          if (this.experience.world?.exhibitionNodes) this.experience.world.exhibitionNodes.show()
          if (this.experience.world?.showcaseNodes) this.experience.world.showcaseNodes.hide()
          if (this.experience.world?.mainTree) this.experience.world.mainTree.showAboveGroundOnly()
          if (this.experience.world?.floor) this.experience.world.floor.show()
        } else {
          this.inShowcaseOrbit = true
          if (this.container) this.container.classList.add('showcase-orbit-mode')
          document.body.classList.remove('phase-tree')
          document.body.classList.add('phase-showcase-orbit')
          if (this.experience.world?.floor) this.experience.world.floor.hide()
          if (this.experience.world?.mainTree) this.experience.world.mainTree.showUndergroundOnly()
          nav.setShowcaseOrbitMode(true)
          cam.setShowcaseOrbitMode()
          cam.showcaseOrbitAngle = Math.atan2(endPos.x, endPos.z - treeZ)
          cam.showcaseOrbitRadius = Math.hypot(endPos.x, endPos.z - treeZ)
          cam.showcaseOrbitHeight = endPos.y

          // Root mode visuals
          if (this.experience.world?.showcaseNodes) this.experience.world.showcaseNodes.show()
          if (this.experience.world?.exhibitionNodes) this.experience.world.exhibitionNodes.hide()
        }

        cam.instance.position.copy(endPos)
        cam.instance.lookAt(endLookAt)
        nav.enabled = true
        this.orbitTransitioning = false
      }
    })
  }

  targetsLookAtFromMode(cam) {
    const treeZ = cam.treePosition.z
    if (cam.mode === 'walk') {
      return cam.walkLookAtTarget ? cam.walkLookAtTarget.clone() : new THREE.Vector3(cam.treePosition.x, 2, treeZ)
    }
    if (cam.mode === 'showcaseOrbit') {
      return new THREE.Vector3(cam.treePosition.x, cam.showcaseLookAtHeight, treeZ)
    }
    if (cam.mode === 'exhibitionOrbit') {
      return new THREE.Vector3(cam.treePosition.x, cam.exhibitionLookAtHeight, treeZ)
    }
    return new THREE.Vector3(cam.treePosition.x, cam.focusLookAtHeight, treeZ)
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
    const forward = new THREE.Vector3()
      .subVectors(nav.targets.front.position, nav.startPosition)
      .normalize()

    // Always return to the exact tree-hub landing position
    const endCamPos = nav.startPosition.clone().add(
      forward.clone().multiplyScalar(nav.treeHubDistanceFromStart)
    )
    endCamPos.y = 1.6
    const endLookAt = nav.targets.front.position.clone()

    const startCamPos = cam.instance.position.clone()
    
    // Determine start look-at from current orbit mode
    let startLookAt
    if (wasInExhibition) {
      startLookAt = new THREE.Vector3(cam.treePosition.x, cam.exhibitionLookAtHeight, cam.treePosition.z)
    } else {
      startLookAt = new THREE.Vector3(cam.treePosition.x, cam.showcaseLookAtHeight, cam.treePosition.z)
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
          nav.scrollProgress = nav.treeLandingScrollProgress
          nav.targetScrollProgress = nav.treeLandingScrollProgress
          nav.enabled = true
          nav.enterTreeHub(endCamPos, endLookAt)
        }
        cam.scrollProgress = nav.treeLandingScrollProgress
        cam.setWalkMode()
        this.showTreeHub()
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
