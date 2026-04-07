import * as THREE from 'three'
import Experience from '../Experience.js'

export default class PanelTalkScene {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    // Position - same as left target (cube position)
    this.targetDistance = 60
    this.position = new THREE.Vector3(
      -this.targetDistance * Math.sin(Math.PI * 2 / 3),
      0,
      -this.targetDistance * Math.cos(Math.PI * 2 / 3)
    )

    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    
    this.videos = []
    this.videoTextures = []
    this.screens = []

    this.createScreens()
    
    this.scene.add(this.group)
  }

  createScreens() {
    // Sample video URLs (using free sample videos)
    const videoSources = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    ]

    // Calculate the viewer position relative to scene (user approaches from forest center)
    // The scene is offset, so we calculate where the user would be viewing from
    const viewerDirection = this.position.clone().negate().normalize()
    this.viewerPoint = viewerDirection.multiplyScalar(15)  // Point 15 units toward forest center
    
    // Screen configurations - spread out horizontally to avoid overlap
    const screenConfigs = [
      // Far left screen
      {
        position: new THREE.Vector3(-14, 3, 2),
        size: { width: 7, height: 4.5 },
        videoIndex: 0
      },
      // Center-left screen
      {
        position: new THREE.Vector3(-5, 3.5, -3),
        size: { width: 6, height: 4 },
        videoIndex: 1
      },
      // Center-right screen
      {
        position: new THREE.Vector3(5, 3.5, -3),
        size: { width: 6, height: 4 },
        videoIndex: 2
      },
      // Far right screen
      {
        position: new THREE.Vector3(14, 3, 2),
        size: { width: 7, height: 4.5 },
        videoIndex: 3
      },
    ]

    // Video titles for popup
    this.videoTitles = [
      'Big Buck Bunny',
      'Elephants Dream',
      'For Bigger Blazes',
      'For Bigger Escapes'
    ]
    
    screenConfigs.forEach((config, index) => {
      this.createVideoScreen(config, videoSources[config.videoIndex], this.videoTitles[config.videoIndex])
    })
  }

  createVideoScreen(config, videoSrc, title = 'Video') {
    // Create video element
    const video = document.createElement('video')
    video.src = videoSrc
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    
    this.videos.push(video)

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    videoTexture.format = THREE.RGBAFormat
    videoTexture.colorSpace = THREE.SRGBColorSpace
    
    this.videoTextures.push(videoTexture)

    // Create screen geometry
    const geometry = new THREE.PlaneGeometry(config.size.width, config.size.height)
    
    // Create material with video texture
    const material = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    })

    // Create screen mesh
    const screen = new THREE.Mesh(geometry, material)
    screen.position.copy(config.position)
    
    // Calculate Y rotation only to face toward user (keep screen vertical)
    const dirToViewer = new THREE.Vector3().subVectors(this.viewerPoint, config.position)
    const angle = Math.atan2(dirToViewer.x, dirToViewer.z)
    screen.rotation.y = angle
    
    this.screens.push(screen)
    this.group.add(screen)
    
    // Store screen data for later registration
    screen.userData.videoSrc = videoSrc
    screen.userData.title = title
    
    // Delay registration until VideoPopup is available
    this.registerScreenWhenReady(screen, videoSrc, title)

    // Add frame/border
    const frameGeometry = new THREE.EdgesGeometry(geometry)
    const frameMaterial = new THREE.LineBasicMaterial({ 
      color: 0x333333,
      linewidth: 2
    })
    const frame = new THREE.LineSegments(frameGeometry, frameMaterial)
    screen.add(frame)

    // Add slight glow backing
    const backingGeometry = new THREE.PlaneGeometry(
      config.size.width + 0.2, 
      config.size.height + 0.2
    )
    const backingMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide
    })
    const backing = new THREE.Mesh(backingGeometry, backingMaterial)
    backing.position.z = -0.05
    screen.add(backing)

    // Add label below screen
    this.addScreenLabel(screen, config)
  }

  addScreenLabel(screen, config) {
    // Create a canvas for the label
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 512
    canvas.height = 64
    
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.font = '24px Arial'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('Film title/author/information', canvas.width / 2, 40)
    
    const labelTexture = new THREE.CanvasTexture(canvas)
    const labelGeometry = new THREE.PlaneGeometry(config.size.width * 0.8, 0.5)
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    })
    
    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.y = -config.size.height / 2 - 0.4
    screen.add(label)
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

  playVideos() {
    this.videos.forEach(video => {
      video.play().catch(e => {
        // Autoplay might be blocked, that's ok
        console.log('Video autoplay blocked, user interaction needed')
      })
    })
  }

  pauseVideos() {
    this.videos.forEach(video => {
      video.pause()
    })
  }

  update() {
    // Update video textures
    this.videoTextures.forEach(texture => {
      if (texture.image && texture.image.readyState >= 2) {
        texture.needsUpdate = true
      }
    })
  }

  dispose() {
    this.videos.forEach(video => {
      video.pause()
      video.src = ''
    })
    
    this.videoTextures.forEach(texture => {
      texture.dispose()
    })
    
    this.screens.forEach(screen => {
      screen.geometry.dispose()
      screen.material.dispose()
    })
    
    this.scene.remove(this.group)
  }
}
