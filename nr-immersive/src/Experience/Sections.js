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
        this.exitExhibitionOrbit()
        this.exitShowcaseOrbit()
        this.experience.transitionToForest()
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

  show() {
    this.visible = true
    this.exhibitionEntryShown = false
    this.inExhibitionOrbit = false
    this.showcaseEntryShown = false
    this.inShowcaseOrbit = false
    if (this.container) {
      this.container.classList.add('is-visible')
    }
    this.updateScroll(0.85)  // Start at exhibition section (top view)
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
  
  exitExhibitionOrbit() {
    if (!this.inExhibitionOrbit) return
    
    this.inExhibitionOrbit = false
    
    // Show sections UI again
    if (this.container) {
      this.container.classList.remove('exhibition-orbit-mode')
    }
    
    // Update body class
    document.body.classList.remove('phase-exhibition-orbit')
    document.body.classList.add('phase-tree')
    
    // Return camera to normal focus mode
    if (this.experience.camera) {
      this.experience.camera.setFocusMode()
    }
    
    // Return navigation to normal
    if (this.experience.navigation) {
      this.experience.navigation.setExhibitionOrbitMode(false)
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
  
  exitShowcaseOrbit() {
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
    
    // Return camera to normal focus mode
    if (this.experience.camera) {
      this.experience.camera.setFocusMode()
    }
    
    // Return navigation to normal
    if (this.experience.navigation) {
      this.experience.navigation.setShowcaseOrbitMode(false)
    }
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
