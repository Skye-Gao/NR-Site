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
    const videoSources = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    ]

    this.videoTitles = [
      'Panel Talk 1',
      'Panel Talk 2',
      'Panel Talk 3',
      'Panel Talk 4',
      'Panel Talk 5',
      'Panel Talk 6',
      'Panel Talk 7',
    ]

    // Approach direction: user walks from forest center toward scene
    const viewerDir = this.position.clone().negate().normalize()
    this.viewerPoint = viewerDir.clone().multiplyScalar(15)

    // Forward = direction user walks INTO the scene (away from forest center)
    const forward = viewerDir.clone().negate()
    // Right = perpendicular to forward (from the walker's perspective)
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()

    // 7 screens arranged front-to-back along the walk path
    // depth = distance along forward from the entry edge
    // lateral = offset to left(-) / right(+)
    const screenLayout = [
      { depth: 2,  lateral: -7.0,  height: 3.0, width: 6,   aspect: 16/9 },
      { depth: 12, lateral:  8.0,  height: 3.2, width: 6.5, aspect: 16/9 },
      { depth: 22, lateral: -10.0, height: 3.0, width: 6,   aspect: 16/9 },
      { depth: 32, lateral:  7.0,  height: 3.4, width: 7,   aspect: 16/9 },
      { depth: 42, lateral: -9.0,  height: 3.0, width: 6,   aspect: 16/9 },
      { depth: 52, lateral:  10.0, height: 3.2, width: 6.5, aspect: 16/9 },
      { depth: 62, lateral: -2.0,  height: 3.3, width: 7,   aspect: 16/9 },
    ]

    const entryLocal = this.viewerPoint.clone()

    screenLayout.forEach((layout, i) => {
      const pos = entryLocal.clone()
        .add(forward.clone().multiplyScalar(layout.depth))
        .add(right.clone().multiplyScalar(layout.lateral))
      pos.y = layout.height

      const h = layout.width / layout.aspect
      const config = {
        position: pos,
        size: { width: layout.width, height: h },
        videoIndex: i
      }

      this.createVideoScreen(config, videoSources[i], this.videoTitles[i])
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

  getGalleryStops(entryWorldPosition) {
    if (!this.screens.length) return []

    this.group.updateMatrixWorld(true)

    const viewerWorldPoint = this.group.localToWorld(this.viewerPoint.clone())
    const stopDistance = 7.2
    const stops = []

    this.screens.forEach((screen, index) => {
      const screenWorld = new THREE.Vector3()
      screen.getWorldPosition(screenWorld)

      // "In front of screen" means between the screen and the forest-side viewer direction.
      const toViewer = new THREE.Vector3().subVectors(viewerWorldPoint, screenWorld).normalize()
      const stopPos = screenWorld.clone().add(toViewer.multiplyScalar(stopDistance))
      stopPos.y = 1.6

      stops.push({
        index,
        position: stopPos,
        lookAt: new THREE.Vector3(screenWorld.x, screenWorld.y, screenWorld.z)
      })
    })

    if (!entryWorldPosition) return stops

    // Ensure order follows the user walk path: closest stop first, furthest last.
    return stops.sort((a, b) => {
      const da = a.position.distanceTo(entryWorldPosition)
      const db = b.position.distanceTo(entryWorldPosition)
      return da - db
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
