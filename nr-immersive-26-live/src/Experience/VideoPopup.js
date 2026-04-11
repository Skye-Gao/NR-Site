import * as THREE from 'three'
import Hls from 'hls.js'
import Experience from './Experience.js'

/** Multiplier for how far from the screen clicks register (vs previous tuning). */
const SCREEN_CLICK_DISTANCE_SCALE = 1.4

export default class VideoPopup {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.sizes = this.experience.sizes
    this.canvas = this.experience.canvas
    
    this.isOpen = false
    this.clickableScreens = []  // Will store { mesh, videoSrc, title } objects
    
    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    // DOM elements
    this.popup = document.getElementById('video-popup')
    this.popupPlayer = document.getElementById('video-popup-player')
    this.popupIframeContainer = document.getElementById('video-popup-iframe-container')
    this.popupIframe = document.getElementById('video-popup-iframe')
    this.popupTitle = document.getElementById('video-popup-title')
    this.popupClose = document.getElementById('video-popup-close')
    
    this.currentType = null  // 'video', 'youtube', 'vimeo', or 'hls'
    this.hls = null  // HLS instance for popup
    
    this.setupEventListeners()
  }
  
  setupEventListeners() {
    // Track mouse for click detection (distinguish from drag)
    this.clickStartX = 0
    this.clickStartY = 0
    this.clickThreshold = 5  // pixels - if moved more than this, it's a drag not a click
    
    window.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.clickStartX = event.clientX
        this.clickStartY = event.clientY
      }
    })
    
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        const dx = Math.abs(event.clientX - this.clickStartX)
        const dy = Math.abs(event.clientY - this.clickStartY)
        
        // Only treat as click if mouse didn't move much (not a drag)
        if (dx < this.clickThreshold && dy < this.clickThreshold) {
          this.onClick(event)
        }
      }
    })
    
    // Hover to change cursor
    window.addEventListener('mousemove', (event) => this.onMouseMove(event))
    
    // Close button
    if (this.popupClose) {
      this.popupClose.addEventListener('click', () => this.close())
    }
    
    // Close on escape key
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })
    
    // Close when clicking outside video
    if (this.popup) {
      this.popup.addEventListener('click', (event) => {
        if (event.target === this.popup) {
          this.close()
        }
      })
    }
  }

  isInteractionBlocked() {
    if (this.isOpen) return true
    const nav = this.experience.navigation
    if (!nav) return false
    if (this.experience.isTransitioning || nav.isSceneTransitioning || nav.welcomeShown || nav.exitConfirmationShown) return true
    if (document.getElementById('scene-welcome')?.classList.contains('is-visible')) return true
    if (document.querySelector('.exit-confirmation')?.classList.contains('is-visible')) return true
    if (document.getElementById('artwork-popup')?.classList.contains('is-visible')) return true
    if (document.getElementById('exhibition-overview')?.classList.contains('is-visible')) return true
    if (document.getElementById('exhibition-entry')?.classList.contains('is-visible')) return true
    if (document.getElementById('showcase-entry')?.classList.contains('is-visible')) return true
    if (document.getElementById('livestream-info-modal')?.classList.contains('is-visible')) return true
    return false
  }

  getScreenScene(screenData) {
    if (screenData.scene) return screenData.scene
    const nav = this.experience.navigation
    const left = nav?.targets?.left?.position
    const right = nav?.targets?.right?.position
    if (!left || !right) return null
    const p = new THREE.Vector3()
    screenData.mesh.getWorldPosition(p)
    return p.distanceTo(left) < p.distanceTo(right) ? 'left' : 'right'
  }

  isScreenInteractable(screenData) {
    const nav = this.experience.navigation
    const cam = this.camera?.instance
    if (!nav || !cam || !screenData?.mesh) return false
    if (this.isInteractionBlocked()) return false
    if (!nav.inScene) return false
    const currentScene = this.experience.world?.currentScene
    const scene = this.getScreenScene(screenData)
    if (!currentScene || currentScene !== scene) return false

    const screenPos = new THREE.Vector3()
    screenData.mesh.getWorldPosition(screenPos)
    const camPos = cam.position.clone()
    const toScreen = screenPos.clone().sub(camPos).normalize()
    const camForward = new THREE.Vector3()
    cam.getWorldDirection(camForward)

    if (scene === 'left') {
      // Panel Talk: only clickable when user is in front of screen.
      const maxDist = 14 * SCREEN_CLICK_DISTANCE_SCALE
      return camForward.dot(toScreen) > 0.75 && camPos.distanceTo(screenPos) < maxDist
    }
    if (scene === 'right') {
      // Livestream: clickable within scaled fraction of display↔landing distance.
      const dir = new THREE.Vector3().subVectors(nav.targets.right.position, nav.startPosition).normalize()
      const landingPos = nav.startPosition.clone().add(dir.multiplyScalar(nav.approachDistance))
      const maxClickDist =
        landingPos.distanceTo(screenPos) * 0.5 * SCREEN_CLICK_DISTANCE_SCALE
      return camPos.distanceTo(screenPos) <= maxClickDist
    }
    return false
  }
  
  onMouseMove(event) {
    if (this.clickableScreens.length === 0) return
    if (!this.camera?.instance) return

    if (this.isInteractionBlocked()) {
      if (this.canvas) this.canvas.style.cursor = ''
      return
    }
    
    // Calculate mouse position (canvas fills window)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera.instance)
    
    // Get all screen meshes
    const meshes = this.clickableScreens.map(s => s.mesh)
    
    // Check for intersections
    const intersects = this.raycaster.intersectObjects(meshes, true)
    
    // Check if hovering over a screen
    let isHovering = false
    if (intersects.length > 0) {
      for (const intersect of intersects) {
        let obj = intersect.object
        while (obj) {
          const screen = this.clickableScreens.find(s => s.mesh === obj)
          if (screen && this.isScreenInteractable(screen)) {
            isHovering = true
            break
          }
          obj = obj.parent
        }
        if (isHovering) break
      }
    }
    
    // Change cursor
    if (this.canvas) {
      if (isHovering) {
        this.canvas.style.cursor = 'pointer'
      } else {
        this.canvas.style.cursor = ''
      }
    }
  }
  
  // Register a clickable screen
  registerScreen(mesh, videoSrc, title = 'Video', scene = null) {
    this.clickableScreens.push({ mesh, videoSrc, title, scene })
  }
  
  // Unregister screens (for cleanup)
  unregisterScreen(mesh) {
    this.clickableScreens = this.clickableScreens.filter(s => s.mesh !== mesh)
  }
  
  onClick(event) {
    if (this.isOpen) return
    if (this.clickableScreens.length === 0) return
    if (!this.camera?.instance) return
    if (this.isInteractionBlocked()) return
    
    // Calculate mouse position in normalized device coordinates (canvas fills window)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera.instance)
    
    // Get all screen meshes
    const meshes = this.clickableScreens.map(s => s.mesh)
    
    // Check for intersections (recursive to handle nested objects)
    const intersects = this.raycaster.intersectObjects(meshes, true)
    
    if (intersects.length > 0) {
      // Check each intersection - it might hit the mesh or a child
      for (const intersect of intersects) {
        let obj = intersect.object
        
        // Check if this object or any of its parents is a registered screen
        while (obj) {
          const screenData = this.clickableScreens.find(s => s.mesh === obj)
          if (screenData && this.isScreenInteractable(screenData)) {
            this.open(screenData.videoSrc, screenData.title)
            return
          }
          obj = obj.parent
        }
      }
    }
  }
  
  // Check if URL is a YouTube link and extract video ID
  getYouTubeVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }
  
  // Check if URL is an HLS stream
  isHLSStream(url) {
    return url && (url.includes('.m3u8') || url.includes('application/vnd.apple.mpegurl'))
  }

  isVimeoEmbed(url) {
    return (
      typeof url === 'string' &&
      url.includes('vimeo.com') &&
      url.includes('/embed/')
    )
  }

  /** Autoplay for Vimeo / other embed URLs (query-safe). */
  embedUrlWithAutoplay(url) {
    try {
      const u = new URL(url, window.location.origin)
      u.searchParams.set('autoplay', '1')
      return u.toString()
    } catch {
      return url.includes('?') ? `${url}&autoplay=1` : `${url}?autoplay=1`
    }
  }
  
  open(videoSrc, title) {
    if (!this.popup) return
    
    this.isOpen = true
    this.popupTitle.textContent = title
    
    // Check if it's a YouTube URL
    const youtubeId = this.getYouTubeVideoId(videoSrc)
    
    if (youtubeId) {
      // YouTube embed
      this.currentType = 'youtube'
      
      // Hide video player, show iframe
      if (this.popupPlayer) this.popupPlayer.classList.add('is-hidden')
      if (this.popupIframeContainer) this.popupIframeContainer.classList.add('is-visible')
      
      // Set YouTube embed URL with autoplay
      if (this.popupIframe) {
        this.popupIframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`
      }
    } else if (this.isVimeoEmbed(videoSrc)) {
      this.currentType = 'vimeo'

      if (this.popupPlayer) this.popupPlayer.classList.add('is-hidden')
      if (this.popupIframeContainer) this.popupIframeContainer.classList.add('is-visible')

      if (this.popupIframe) {
        this.popupIframe.src = this.embedUrlWithAutoplay(videoSrc)
      }
    } else if (this.isHLSStream(videoSrc)) {
      // HLS stream
      this.currentType = 'hls'
      
      // Show video player, hide iframe
      if (this.popupPlayer) this.popupPlayer.classList.remove('is-hidden')
      if (this.popupIframeContainer) this.popupIframeContainer.classList.remove('is-visible')
      
      // Setup HLS for popup
      if (Hls.isSupported() && this.popupPlayer) {
        this.hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        })
        this.hls.loadSource(videoSrc)
        this.hls.attachMedia(this.popupPlayer)
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.popupPlayer.play().catch(e => {
            console.log('HLS autoplay blocked in popup')
          })
        })
      } else if (this.popupPlayer?.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        this.popupPlayer.src = videoSrc
        this.popupPlayer.play().catch(e => {
          console.log('HLS autoplay blocked in popup')
        })
      }
    } else {
      // Regular video
      this.currentType = 'video'
      
      // Show video player, hide iframe
      if (this.popupPlayer) this.popupPlayer.classList.remove('is-hidden')
      if (this.popupIframeContainer) this.popupIframeContainer.classList.remove('is-visible')
      
      // Set video source
      if (this.popupPlayer) {
        this.popupPlayer.src = videoSrc
        this.popupPlayer.play().catch(e => {
          console.log('Video autoplay blocked')
        })
      }
    }
    
    // Show popup
    this.popup.classList.add('is-visible')
    
    // Disable navigation
    if (this.experience.navigation) {
      this.experience.navigation.enabled = false
    }
    
    // Change cursor
    document.body.style.cursor = 'default'
  }
  
  close() {
    if (!this.popup) return
    
    this.isOpen = false
    
    if (this.currentType === 'youtube' || this.currentType === 'vimeo') {
      if (this.popupIframe) this.popupIframe.src = ''
      if (this.popupIframeContainer) this.popupIframeContainer.classList.remove('is-visible')
    } else if (this.currentType === 'hls') {
      // Clean up HLS
      if (this.hls) {
        this.hls.destroy()
        this.hls = null
      }
      if (this.popupPlayer) {
        this.popupPlayer.pause()
        this.popupPlayer.src = ''
      }
    } else {
      // Pause and reset regular video
      if (this.popupPlayer) {
        this.popupPlayer.pause()
        this.popupPlayer.currentTime = 0
      }
    }
    
    // Reset to default state
    if (this.popupPlayer) this.popupPlayer.classList.remove('is-hidden')
    
    // Hide popup
    this.popup.classList.remove('is-visible')
    
    // Re-enable navigation
    if (this.experience.navigation) {
      this.experience.navigation.enabled = true
    }
    
    // Restore cursor
    document.body.style.cursor = 'grab'
    
    this.currentType = null
  }
  
  update() {
    // Check if mouse is over a clickable screen to change cursor
    if (this.isOpen || this.clickableScreens.length === 0) return
    
    // This could be optimized to only run on mousemove
  }
  
  dispose() {
    this.clickableScreens = []
  }
}
