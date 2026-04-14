import * as THREE from 'three'
import Experience from '../Experience.js'
import { getWalkEyeWorldY } from './worldGroundLevel.js'

/** Display gain vs livestream-style defaults; 0.7 ≈ 30% dimmer. */
const PANEL_DISPLAY_BRIGHTNESS = 0.7

/** Lateral pull toward landing (forest-side); scales left/right offsets only. */
const PANEL_SCREEN_LATERAL_SCALE = 0.6

/** Depth along the walk path; >1 spreads screens farther apart in the forward direction. */
const PANEL_SCREEN_DEPTH_SCALE = 0.6 * 1.35

const PANEL_TALK_EVENTS = [
  {
    title: 'Community Spotlight',
    date: 'Monday 13th April',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'Interspecies Music: On the Nature of Music and the Music of Nature',
    date: 'Friday 17th April',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'The Nature Delusion - why we can\'t fix the world without fixing ourselves',
    date: 'Sunday 19th April',
    time: '10am PST / 1pm EST / 6pm GMT'
  },
  {
    title: 'Panel Discussion - Youth Activism',
    date: 'Monday 20th April',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'Panel Discussion - Healing & Resilience through nature’s wisdom',
    date: 'Tuesday 21st April',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'Panel Discussion - Rights of Nature',
    date: 'Wednesday 22nd April - EARTH DAY!',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'Community Spotlight',
    date: 'Friday 24th April',
    time: '9am PST / 12pm EST / 5pm GMT'
  },
  {
    title: 'Panel Discussion - Founders Discussion',
    date: 'Sunday 26th April',
    time: '9am PST / 12pm EST / 5pm GMT'
  }
]

const PANEL_SCREEN_LAYOUT = [
  { depth: 2, lateral: -7.0, height: 3.0, width: 6, aspect: 16 / 9 },
  { depth: 12, lateral: 8.0, height: 3.2, width: 6.5, aspect: 16 / 9 },
  { depth: 22, lateral: -10.0, height: 3.0, width: 6, aspect: 16 / 9 },
  { depth: 32, lateral: 7.0, height: 3.4, width: 7, aspect: 16 / 9 },
  { depth: 42, lateral: -9.0, height: 3.0, width: 6, aspect: 16 / 9 },
  { depth: 52, lateral: 10.0, height: 3.2, width: 6.5, aspect: 16 / 9 },
  { depth: 62, lateral: -2.0, height: 3.3, width: 7, aspect: 16 / 9 },
  { depth: 72, lateral: 6.0, height: 3.3, width: 7, aspect: 16 / 9 }
]

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
    /** One texture shared by all panel screens (NRF banner). */
    this.sharedPosterTexture = null

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
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    ]

    this.videoTitles = PANEL_TALK_EVENTS.map((eventInfo) => eventInfo.title)

    // Approach direction: user walks from forest center toward scene
    const viewerDir = this.position.clone().negate().normalize()
    this.viewerPoint = viewerDir.clone().multiplyScalar(15)

    // Forward = direction user walks INTO the scene (away from forest center)
    const forward = viewerDir.clone().negate()
    // Right = perpendicular to forward (from the walker's perspective)
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()

    // 8 screens arranged front-to-back along the walk path
    // depth = distance along forward from the entry edge
    // lateral = offset to left(-) / right(+)
    const screenLayout = PANEL_SCREEN_LAYOUT

    const entryLocal = this.viewerPoint.clone()

    const posterPath = '/livestream/NRF 2026 Banner_Mainstage.png'
    const posterUrl = encodeURI(posterPath)

    screenLayout.forEach((layout, i) => {
      const depthPart = forward
        .clone()
        .multiplyScalar(layout.depth * PANEL_SCREEN_DEPTH_SCALE)
      const lateralPart = right
        .clone()
        .multiplyScalar(layout.lateral * PANEL_SCREEN_LATERAL_SCALE)
      const pos = entryLocal.clone().add(depthPart).add(lateralPart)
      pos.y = layout.height

      const h = layout.width / layout.aspect
      const config = {
        position: pos,
        size: { width: layout.width, height: h },
        videoIndex: i
      }

      const eventInfo = PANEL_TALK_EVENTS[i] || null
      const videoSrc = videoSources[i] || videoSources[0]
      this.createVideoScreen(config, videoSrc, eventInfo, posterUrl)
    })

    new THREE.TextureLoader().load(
      posterUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        this.sharedPosterTexture = tex
        for (const screen of this.screens) {
          if (!screen.material) continue
          screen.material.map = tex
          const g = 1.45 * PANEL_DISPLAY_BRIGHTNESS
          screen.material.color.setRGB(g, g, g)
          screen.material.needsUpdate = true
          const bloomMat = screen.userData.bloomMaterial
          if (bloomMat) {
            bloomMat.map = tex
            bloomMat.needsUpdate = true
          }
        }
        this.experience.warmupSideStagePosterTexture?.(tex)
        this.experience.kickSideStageShaderWarmup?.()
      },
      undefined,
      () => console.warn('Panel Talk poster failed to load:', posterUrl)
    )
  }

  createVideoScreen(config, videoSrc, eventInfo = null, posterUrl = '') {
    const title = eventInfo?.title || 'Panel Talk'
    // Create video element (texture drives popup; mesh stays on shared poster)
    const video = document.createElement('video')
    video.src = videoSrc
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    if (posterUrl) video.poster = posterUrl

    this.videos.push(video)

    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    videoTexture.format = THREE.RGBAFormat
    videoTexture.colorSpace = THREE.SRGBColorSpace

    this.videoTextures.push(videoTexture)

    const geometry = new THREE.PlaneGeometry(config.size.width, config.size.height)

    const material = new THREE.MeshBasicMaterial({
      map: null,
      color: 0x152018,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      toneMapped: false
    })

    const screen = new THREE.Mesh(geometry, material)
    screen.position.copy(config.position)

    const dirToViewer = new THREE.Vector3().subVectors(this.viewerPoint, config.position)
    const angle = Math.atan2(dirToViewer.x, dirToViewer.z)
    screen.rotation.y = angle

    this.screens.push(screen)
    this.group.add(screen)

    screen.userData.videoSrc = videoSrc
    screen.userData.title = title
    screen.userData.eventInfo = eventInfo

    this.registerScreenWhenReady(screen, videoSrc, title)

    const b = PANEL_DISPLAY_BRIGHTNESS
    const bloomMaterial = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.48 * b,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      color: new THREE.Color(1.2 * b, 1.2 * b, 1.2 * b)
    })
    screen.userData.bloomMaterial = bloomMaterial
    const bloomMesh = new THREE.Mesh(geometry, bloomMaterial)
    bloomMesh.position.z = 0.022
    bloomMesh.renderOrder = 4
    screen.add(bloomMesh)

    const frameGeometry = new THREE.EdgesGeometry(geometry)
    const frameMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.9,
      toneMapped: false
    })
    const frame = new THREE.LineSegments(frameGeometry, frameMaterial)
    frame.position.z = 0.045
    frame.renderOrder = 2
    screen.add(frame)

    const backingGeometry = new THREE.PlaneGeometry(
      config.size.width + 0.35,
      config.size.height + 0.35
    )
    const backingMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    const backing = new THREE.Mesh(backingGeometry, backingMaterial)
    backing.position.z = -0.08
    backing.renderOrder = -1
    screen.add(backing)

    // Add label below screen
    this.addScreenLabel(screen, config, eventInfo)
  }

  wrapLabelText(ctx, text, maxWidth) {
    if (!text) return []
    const words = text.split(/\s+/)
    const lines = []
    let current = ''
    words.forEach((word) => {
      const probe = current ? `${current} ${word}` : word
      if (ctx.measureText(probe).width <= maxWidth || !current) {
        current = probe
      } else {
        lines.push(current)
        current = word
      }
    })
    if (current) lines.push(current)
    return lines
  }

  addScreenLabel(screen, config, eventInfo = null) {
    // Create a canvas for the label
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 1024
    canvas.height = 230
    
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const titleText = eventInfo?.title || 'Panel discussion'
    const dateText = eventInfo?.date || ''
    const timeText = eventInfo?.time || ''

    ctx.font = '600 40px Outfit, Inter, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxTextWidth = canvas.width * 0.92
    const titleLines = this.wrapLabelText(ctx, titleText, maxTextWidth)

    let y = 58
    titleLines.forEach((line) => {
      ctx.fillText(line, canvas.width / 2, y)
      y += 46
    })

    if (dateText) {
      ctx.font = '500 30px Outfit, Inter, Arial, sans-serif'
      ctx.fillStyle = 'rgba(226, 238, 255, 0.88)'
      ctx.fillText(dateText, canvas.width / 2, y + 16)
      y += 50
    }

    if (timeText) {
      ctx.font = '500 27px Outfit, Inter, Arial, sans-serif'
      ctx.fillStyle = 'rgba(185, 204, 218, 0.86)'
      ctx.fillText(timeText, canvas.width / 2, y + 14)
    }

    const labelTexture = new THREE.CanvasTexture(canvas)
    labelTexture.colorSpace = THREE.SRGBColorSpace
    const labelGeometry = new THREE.PlaneGeometry(config.size.width * 1.08, 1.35)
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    
    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.y = -config.size.height / 2 - 0.86
    screen.add(label)
  }

  registerScreenWhenReady(screen, videoSrc, title) {
    // Check if VideoPopup is available, if not wait and retry
    const tryRegister = () => {
      if (this.experience.videoPopup) {
        this.experience.videoPopup.registerScreen(screen, videoSrc, title, 'left')
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
    // Keep video textures current for the popup; mesh stays on the shared poster.
    this.videoTextures.forEach((texture) => {
      const img = texture.image
      if (
        img &&
        img.readyState >= 2 &&
        img.videoWidth > 0 &&
        img.videoHeight > 0
      ) {
        texture.needsUpdate = true
      }
    })
  }

  getGalleryStops(entryWorldPosition, cameraEyeY = getWalkEyeWorldY()) {
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
      stopPos.y = cameraEyeY

      stops.push({
        index,
        position: stopPos,
        lookAt: new THREE.Vector3(screenWorld.x, screenWorld.y, screenWorld.z),
        eventInfo: screen.userData?.eventInfo || null
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
    this.videos.forEach((video) => {
      video.pause()
      video.src = ''
    })

    this.videoTextures.forEach((texture) => {
      texture.dispose()
    })

    const poster = this.sharedPosterTexture
    this.sharedPosterTexture = null

    const geometries = new Set()
    for (const screen of this.screens) {
      screen.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry)
        const mat = obj.material
        if (!mat) return
        if (mat.map && mat.map !== poster) mat.map.dispose()
        if (mat.map === poster) mat.map = null
        mat.dispose()
      })
    }
    geometries.forEach((g) => g.dispose())

    if (poster) poster.dispose()

    this.scene.remove(this.group)
  }
}
