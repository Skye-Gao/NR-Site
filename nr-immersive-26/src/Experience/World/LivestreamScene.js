import * as THREE from 'three'
import Hls from 'hls.js'
import Experience from '../Experience.js'

export default class LivestreamScene {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    // Position - same as right target (sphere position)
    this.targetDistance = 60
    this.position = new THREE.Vector3(
      -this.targetDistance * Math.sin(-Math.PI * 2 / 3),
      0,
      -this.targetDistance * Math.cos(-Math.PI * 2 / 3)
    )

    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    
    this.video = null
    this.videoTexture = null
    this.screen = null
    this.hls = null

    this.createScreen()
    
    this.scene.add(this.group)
  }

  createScreen() {
    // Calculate the viewer position relative to scene (user approaches from forest center)
    const viewerDirection = this.position.clone().negate().normalize()
    const viewerPoint = viewerDirection.multiplyScalar(15)
    
    // HLS Live Stream URL
    // Using a reliable test stream (Big Buck Bunny HLS - loops continuously)
    // Replace with your own HLS stream URL (.m3u8) when ready
    this.hlsStreamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
    
    // Fallback video if HLS fails
    const fallbackVideoSrc = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

    // Create video element
    this.video = document.createElement('video')
    this.video.crossOrigin = 'anonymous'
    this.video.loop = false  // Live streams don't loop
    this.video.muted = true
    this.video.playsInline = true
    this.video.preload = 'auto'
    
    // Setup HLS streaming
    this.setupHLS(fallbackVideoSrc)

    // Create video texture (after video element is setup)
    this.videoTexture = new THREE.VideoTexture(this.video)
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter
    this.videoTexture.format = THREE.RGBAFormat
    this.videoTexture.colorSpace = THREE.SRGBColorSpace

    // Create large screen geometry (16:9 aspect ratio)
    const screenWidth = 16
    const screenHeight = 9
    const geometry = new THREE.PlaneGeometry(screenWidth, screenHeight)
    
    // Create material with video texture
    const material = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.98
    })

    // Create screen mesh - centered at comfortable viewing height
    this.screen = new THREE.Mesh(geometry, material)
    this.screen.position.set(0, 6, 0)  // Higher position so camera looks up at it slightly
    
    // Calculate Y rotation only to face toward user (keep screen vertical)
    const viewerPointFlat = new THREE.Vector3(viewerPoint.x, 0, viewerPoint.z)
    const angle = Math.atan2(viewerPointFlat.x, viewerPointFlat.z)
    this.screen.rotation.y = angle
    
    this.group.add(this.screen)
    
    // Store info for popup
    this.videoTitle = 'Live Stream'
    
    // Delay registration until VideoPopup is available
    // Use the same HLS stream URL for the popup
    this.registerScreenWhenReady(this.screen, this.hlsStreamUrl, this.videoTitle)

    // Add frame/border
    const frameGeometry = new THREE.EdgesGeometry(geometry)
    const frameMaterial = new THREE.LineBasicMaterial({ 
      color: 0x444444,
      linewidth: 2
    })
    const frame = new THREE.LineSegments(frameGeometry, frameMaterial)
    this.screen.add(frame)

    // Add backing
    const backingGeometry = new THREE.PlaneGeometry(screenWidth + 0.3, screenHeight + 0.3)
    const backingMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide
    })
    const backing = new THREE.Mesh(backingGeometry, backingMaterial)
    backing.position.z = -0.05
    this.screen.add(backing)

    // Add label below screen
    this.addScreenLabel()
  }

  addScreenLabel() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 512
    canvas.height = 64
    
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.font = 'bold 28px Arial'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.textAlign = 'center'
    ctx.fillText('LIVE', canvas.width / 2, 40)
    
    const labelTexture = new THREE.CanvasTexture(canvas)
    const labelGeometry = new THREE.PlaneGeometry(3, 0.6)
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    })
    
    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.y = -5  // Below the screen
    this.screen.add(label)
  }

  setupHLS(fallbackVideoSrc) {
    // Check if HLS is supported
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      })
      
      this.hls.loadSource(this.hlsStreamUrl)
      this.hls.attachMedia(this.video)
      
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded - Live stream ready')
        // Auto-play when manifest is ready
        this.video.play().catch(e => {
          console.log('HLS autoplay blocked, will play on scene enter')
        })
      })
      
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS fatal error, falling back to regular video:', data.type)
          this.hls.destroy()
          this.hls = null
          // Fallback to regular video
          this.video.src = fallbackVideoSrc
          this.video.loop = true
        }
      })
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.video.src = this.hlsStreamUrl
    } else {
      // No HLS support, use fallback
      console.log('HLS not supported, using fallback video')
      this.video.src = fallbackVideoSrc
      this.video.loop = true
    }
  }

  registerScreenWhenReady(screen, videoSrc, title) {
    // Check if VideoPopup is available, if not wait and retry
    const tryRegister = () => {
      if (this.experience.videoPopup) {
        this.experience.videoPopup.registerScreen(screen, videoSrc, title)
      } else {
        setTimeout(tryRegister, 100)
      }
    }
    tryRegister()
  }

  playVideo() {
    if (this.video) {
      this.video.play().catch(e => {
        console.log('Video autoplay blocked, user interaction needed')
      })
    }
  }

  pauseVideo() {
    if (this.video) {
      this.video.pause()
    }
  }

  update() {
    if (this.videoTexture && this.video && this.video.readyState >= 2) {
      this.videoTexture.needsUpdate = true
    }
  }

  dispose() {
    // Clean up HLS
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    
    if (this.video) {
      this.video.pause()
      this.video.src = ''
    }
    
    if (this.videoTexture) {
      this.videoTexture.dispose()
    }
    
    if (this.screen) {
      this.screen.geometry.dispose()
      this.screen.material.dispose()
    }
    
    this.scene.remove(this.group)
  }
}
