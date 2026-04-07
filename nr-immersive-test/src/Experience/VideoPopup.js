import * as THREE from 'three'
import Hls from 'hls.js'
import Experience from './Experience.js'

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
    
    this.currentType = null  // 'video', 'youtube', or 'hls'
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
  
  onMouseMove(event) {
    if (this.isOpen || this.clickableScreens.length === 0) return
    if (!this.camera?.instance) return
    
    // Only show pointer when in a scene (past welcome popup)
    const currentScene = this.experience.world?.currentScene
    if (!currentScene || (currentScene !== 'left' && currentScene !== 'right')) {
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
          if (this.clickableScreens.find(s => s.mesh === obj)) {
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
  registerScreen(mesh, videoSrc, title = 'Video') {
    this.clickableScreens.push({ mesh, videoSrc, title })
  }
  
  // Unregister screens (for cleanup)
  unregisterScreen(mesh) {
    this.clickableScreens = this.clickableScreens.filter(s => s.mesh !== mesh)
  }
  
  onClick(event) {
    if (this.isOpen) return
    if (this.clickableScreens.length === 0) return
    if (!this.camera?.instance) return
    
    // Only allow clicks after user has entered a scene (past welcome popup)
    const currentScene = this.experience.world?.currentScene
    if (!currentScene || (currentScene !== 'left' && currentScene !== 'right')) return
    
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
          if (screenData) {
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
    
    if (this.currentType === 'youtube') {
      // Clear iframe src to stop video
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
