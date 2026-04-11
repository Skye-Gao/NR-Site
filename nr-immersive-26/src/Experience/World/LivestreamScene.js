import * as THREE from 'three'
import Experience from '../Experience.js'

/** Vimeo Live Event embed (popup); mesh uses static poster — iframe cannot drive WebGL textures. */
const VIMEO_MAINSTAGE_EMBED_URL =
  'https://vimeo.com/event/5861006/embed/abacdbb082/interaction'

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

    this.posterTexture = null
    this.screen = null
    /** 3D screen stays on the static poster; stream plays in the HTML popup (Vimeo embed). */
    this.posterOnMesh = true
    this.posterLoadSettled = false
    this.screenBloomMaterial = null

    this.createScreen()

    this.scene.add(this.group)
  }

  createScreen() {
    const viewerDirection = this.position.clone().negate().normalize()
    const viewerPoint = viewerDirection.multiplyScalar(15)

    const posterPath = '/livestream/NRF 2026 Banner_Mainstage.png'
    const posterUrl = encodeURI(posterPath)

    this.displayScale = 1.2
    const screenWidth = 16 * this.displayScale
    const screenHeight = 9 * this.displayScale
    const geometry = new THREE.PlaneGeometry(screenWidth, screenHeight)

    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      posterUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        this.posterTexture = tex
        this.posterLoadSettled = true
        this.posterOnMesh = true
        if (this.screen?.material) {
          this.screen.material.map = tex
          this.screen.material.color.setRGB(1.45, 1.45, 1.45)
          this.screen.material.needsUpdate = true
        }
        if (this.screenBloomMaterial) {
          this.screenBloomMaterial.map = tex
          this.screenBloomMaterial.needsUpdate = true
        }
        this.experience.warmupSideStagePosterTexture?.(tex)
        this.experience.kickSideStageShaderWarmup?.()
      },
      undefined,
      () => {
        console.warn('Livestream poster failed to load:', posterUrl)
        this.posterLoadSettled = true
        this.posterOnMesh = false
      }
    )

    const material = new THREE.MeshBasicMaterial({
      color: 0x152018,
      map: null,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      toneMapped: false
    })

    this.screen = new THREE.Mesh(geometry, material)
    this.screen.position.set(0, 6, 0)

    const viewerPointFlat = new THREE.Vector3(viewerPoint.x, 0, viewerPoint.z)
    const angle = Math.atan2(viewerPointFlat.x, viewerPointFlat.z)
    this.screen.rotation.y = angle

    this.group.add(this.screen)

    this.screenBloomMaterial = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      color: new THREE.Color(1.2, 1.2, 1.2)
    })
    const screenBloom = new THREE.Mesh(geometry, this.screenBloomMaterial)
    screenBloom.position.z = 0.022
    screenBloom.renderOrder = 4
    this.screen.add(screenBloom)

    this.videoTitle = 'Natural Resonance Festival 2026'

    this.registerScreenWhenReady(this.screen, VIMEO_MAINSTAGE_EMBED_URL, this.videoTitle)

    const backingMargin = 0.35 * this.displayScale
    const backingGeometry = new THREE.PlaneGeometry(
      screenWidth + backingMargin,
      screenHeight + backingMargin
    )
    const backingMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    const backing = new THREE.Mesh(backingGeometry, backingMaterial)
    backing.position.z = -0.08
    backing.renderOrder = -1
    this.screen.add(backing)

    const edgeGeo = new THREE.EdgesGeometry(geometry)
    const frame = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.9,
        toneMapped: false
      })
    )
    frame.position.z = 0.045
    frame.renderOrder = 2
    this.screen.add(frame)

    this.addScreenLabel()
  }

  addScreenLabel() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 1024
    canvas.height = 128

    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.font = 'bold 34px Arial'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Livestream of Festival', canvas.width / 2, canvas.height / 2)

    const labelTexture = new THREE.CanvasTexture(canvas)
    labelTexture.colorSpace = THREE.SRGBColorSpace

    // Plane aspect must match canvas aspect or the texture stretches on the mesh.
    const texAspect = canvas.width / canvas.height
    const labelH = 0.55 * this.displayScale
    const labelW = labelH * texAspect
    const labelGeometry = new THREE.PlaneGeometry(labelW, labelH)
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    })

    const label = new THREE.Mesh(labelGeometry, labelMaterial)
    label.position.y = -5 * this.displayScale
    this.screen.add(label)
  }

  registerScreenWhenReady(screen, embedUrl, title) {
    const tryRegister = () => {
      if (this.experience.videoPopup) {
        this.experience.videoPopup.registerScreen(screen, embedUrl, title, 'right')
      } else {
        setTimeout(tryRegister, 100)
      }
    }
    tryRegister()
  }

  playVideo() {}

  pauseVideo() {}

  update() {}

  dispose() {
    if (this.posterTexture) {
      this.posterTexture.dispose()
      this.posterTexture = null
    }

    if (this.screenBloomMaterial) {
      this.screenBloomMaterial.dispose()
      this.screenBloomMaterial = null
    }

    if (this.screen) {
      this.screen.geometry.dispose()
      this.screen.material.dispose()
    }

    this.scene.remove(this.group)
  }
}
