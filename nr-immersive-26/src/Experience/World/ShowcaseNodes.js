import * as THREE from 'three'
import Experience from '../Experience.js'
import { WORLD_GROUND_LEVEL_Y } from './worldGroundLevel.js'
import showcaseManifest from '../../data/showcaseManifest.json'
import { galleryAssetUrl, formatMediaLabel, pausePopupMedia } from '../../data/galleryUrls.js'

/** Stable [0, 1) pseudo-random for cluster layout (same inputs → same position every frame). */
function clusterRandom01(clusterIndex, indexInCluster, folder, channel) {
  let h = 2166136261 >>> 0
  const mix = (v) => {
    h ^= v
    h = Math.imul(h, 16777619) >>> 0
  }
  mix((clusterIndex + 1009) | 0)
  mix((indexInCluster + 2003) | 0)
  mix((channel + 311) | 0)
  for (let i = 0; i < folder.length; i++) mix(folder.charCodeAt(i))
  mix((channel * 7919) | 0)
  return (h >>> 0) / 4294967296
}

export default class ShowcaseNodes {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.debug = this.experience.debug

    this.treePosition = new THREE.Vector3(0, WORLD_GROUND_LEVEL_Y, -60)

    this.nodeSettings = {
      baseHeight: -8,
      heightVariation: 5,
      orbitRadius: 10,
      radiusVariation: 4,
      baseScale: 0.55,
      floatAmplitude: 0.08,
      floatSpeed: 0.5,
      /** Max half-extent along tangent (right) for random cloud (m). */
      clusterSpread: 1.32,
      /** Max half-extent inward/outward from tree for random cloud (m). */
      clusterRadialBump: 1.2,
      /** Max half-extent vertical jitter within cluster (m). */
      clusterVerticalStep: 1.4,
    }

    this.nodes = []
    this.nodeData = this.buildNodeDataFromManifest()

    this.group = new THREE.Group()
    this.textureLoader = new THREE.TextureLoader()

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.visible = false

    this.popup = document.getElementById('artwork-popup')
    this.popupTitle = document.getElementById('artwork-title')
    this.popupArtist = document.getElementById('artwork-artist')
    this.popupDescription = document.getElementById('artwork-description')
    this.popupMediaStack = document.getElementById('artwork-media-stack')
    this.popupClose = document.getElementById('artwork-popup-close')

    this.createNodes()
    this.updateNodePositions()
    this.createConnectingLines()
    this.setupEventListeners()
    this.setupDebug()

    this.scene.add(this.group)
    this.group.visible = false
  }

  appendArtistTextSection(container, label, text, options = {}) {
    const t = (text || '').trim()
    if (!t) return
    const lab = document.createElement('div')
    lab.className = 'artwork-popup-section-label'
    lab.textContent = label
    const body = document.createElement('div')
    body.className = 'artwork-popup-prose'
    body.style.whiteSpace = 'pre-line'
    body.textContent = t
    container.appendChild(lab)
    container.appendChild(body)
    if (options.dividerAfter) {
      const rule = document.createElement('div')
      rule.className = 'artwork-popup-section-divider'
      rule.setAttribute('aria-hidden', 'true')
      container.appendChild(rule)
    }
  }

  buildNodeDataFromManifest() {
    const base = showcaseManifest.baseFolder
    const artists = showcaseManifest.artists.filter((a) => a.media?.length)
    const flat = []
    let nid = 0

    artists.forEach((a, clusterIndex) => {
      const work = (a.workTitle || '').trim()
      const displayTitle = work || a.name
      const sharedMedia = a.media.map((m) => ({
        file: m.file,
        type: m.type,
        url: galleryAssetUrl(base, a.folder, m.file),
      }))
      const clusterSize = a.media.length
      const statement = (a.artistStatement || '').replace(/\r\n/g, '\n').trim()
      const bio = (a.bio || '').replace(/\r\n/g, '\n').trim()
      const planeW = clusterSize > 3 ? 1.85 : 2.05
      const planeH = clusterSize > 3 ? 2.35 : 2.65

      a.media.forEach((m, indexInCluster) => {
        const url = galleryAssetUrl(base, a.folder, m.file)
        let image = null
        let videoPosterUrl = null
        if (m.type === 'image') image = url
        else if (m.type === 'video') videoPosterUrl = url

        flat.push({
          id: ++nid,
          folder: a.folder,
          clusterIndex,
          indexInCluster,
          clusterSize,
          primaryFile: m.file,
          primaryType: m.type,
          title: displayTitle,
          artist: a.name,
          image,
          videoPosterUrl,
          media: sharedMedia,
          artistStatement: statement,
          bio,
          size: { width: planeW, height: planeH },
        })
      })
    })

    return flat
  }

  setupDebug() {
    if (!this.debug.ui) return

    const folder = this.debug.ui.addFolder('Showcase (roots) nodes')
    folder.close()

    folder.add(this.nodeSettings, 'baseHeight').min(-20).max(10).step(0.5).name('Base Height').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'heightVariation').min(0).max(5).step(0.5).name('Height Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'orbitRadius').min(5).max(20).step(0.5).name('Orbit Radius').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'radiusVariation').min(0).max(5).step(0.5).name('Radius Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'baseScale').min(0.5).max(2).step(0.1).name('Base Scale').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'floatAmplitude').min(0).max(0.5).step(0.05).name('Float Amplitude')
    folder.add(this.nodeSettings, 'floatSpeed').min(0.1).max(3).step(0.1).name('Float Speed')
    folder.add(this.nodeSettings, 'clusterSpread').min(0.2).max(2).step(0.02).name('Cluster tangent spread').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'clusterRadialBump').min(0).max(1.2).step(0.02).name('Cluster depth spread').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'clusterVerticalStep').min(0).max(1.4).step(0.02).name('Cluster vertical spread').onChange(() => this.updateNodePositions())
  }

  updateNodePositions() {
    const s = this.nodeSettings
    const treeZ = this.treePosition.z
    let numClusters = 0
    if (this.nodeData.length > 0) {
      numClusters = Math.max(...this.nodeData.map((d) => d.clusterIndex)) + 1
    }

    this.nodes.forEach((mesh, index) => {
      const data = this.nodeData[index]
      const c = data.clusterIndex
      const j = data.indexInCluster
      const n = data.clusterSize

      const angleStep = numClusters > 0 ? (Math.PI * 2) / numClusters : 0
      const clusterAngle = c * angleStep + Math.sin(c * 1.7) * 0.12
      const radiusOffset = Math.sin(c * 2.3) * s.radiusVariation
      const radius = s.orbitRadius + radiusOffset

      const centerX = Math.sin(clusterAngle) * radius
      const centerZ = treeZ + Math.cos(clusterAngle) * radius
      const baseY = s.baseHeight + Math.sin(c * 1.5) * s.heightVariation + WORLD_GROUND_LEVEL_Y

      const forward = new THREE.Vector3(centerX, 0, centerZ - treeZ)
      if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1)
      forward.normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(up, forward).normalize()

      const folder = data.folder
      const scaleN = Math.max(1, Math.sqrt(n) * 0.72)
      let offR = 0
      let offF = 0
      let offY = 0
      if (n > 1) {
        const r0 = clusterRandom01(c, j, folder, 0)
        const r1 = clusterRandom01(c, j, folder, 1)
        const r2 = clusterRandom01(c, j, folder, 2)
        const r3 = clusterRandom01(c, j, folder, 3)
        const r4 = clusterRandom01(c, j, folder, 4)
        // Uniform-ish samples in a horizontal disk (right × forward), then depth + vertical jitter
        const ang = r0 * Math.PI * 2
        const rad = Math.sqrt(r1) * s.clusterSpread * scaleN
        offR = Math.cos(ang) * rad + (r4 - 0.5) * s.clusterSpread * 0.28
        offF = Math.sin(ang) * rad + (r2 - 0.5) * 2 * s.clusterRadialBump * scaleN * 0.45
        offY = (r3 - 0.5) * 2 * s.clusterVerticalStep * scaleN
      }

      const x = centerX + right.x * offR + forward.x * offF
      const z = centerZ + right.z * offR + forward.z * offF
      const y = baseY + offY

      mesh.position.set(x, y, z)
      mesh.scale.setScalar(s.baseScale)

      const faceAngle = Math.atan2(x, z - treeZ)
      mesh.rotation.y = faceAngle
      mesh.rotation.x = mesh.userData.tiltX ?? 0
      mesh.rotation.z = mesh.userData.tiltZ ?? 0

      mesh.userData.baseY = y
    })

    this.updateConnectingLines()
  }

  createConnectingLines() {
    this.linesGroup = new THREE.Group()
    this.lines = []

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
    })

    const byCluster = new Map()
    this.nodes.forEach((_, i) => {
      const c = this.nodeData[i].clusterIndex
      if (!byCluster.has(c)) byCluster.set(c, [])
      byCluster.get(c).push(i)
    })

    for (const indices of byCluster.values()) {
      if (indices.length < 2) continue
      const mat = lineMaterial.clone()
      if (indices.length === 2) {
        this.createLine(indices[0], indices[1], mat)
        continue
      }
      for (let i = 0; i < indices.length; i++) {
        this.createLine(indices[i], indices[(i + 1) % indices.length], mat.clone())
      }
    }

    this.group.add(this.linesGroup)
  }

  createLine(fromIndex, toIndex, material) {
    const points = [this.nodes[fromIndex].position.clone(), this.nodes[toIndex].position.clone()]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(geometry, material)
    line.userData = { fromIndex, toIndex }
    this.lines.push(line)
    this.linesGroup.add(line)
  }

  updateConnectingLines() {
    if (!this.lines) return

    this.lines.forEach((line) => {
      const { fromIndex, toIndex } = line.userData
      const positions = line.geometry.attributes.position.array
      const fromPos = this.nodes[fromIndex].position
      const toPos = this.nodes[toIndex].position
      positions[0] = fromPos.x
      positions[1] = fromPos.y
      positions[2] = fromPos.z
      positions[3] = toPos.x
      positions[4] = toPos.y
      positions[5] = toPos.z
      line.geometry.attributes.position.needsUpdate = true
    })
  }

  createNodes() {
    this.nodeData.forEach((data) => {
      const geometry = new THREE.PlaneGeometry(data.size.width, data.size.height)
      let material
      let videoEl = null
      let videoTex = null

      if (data.image) {
        const texture = this.textureLoader.load(data.image)
        texture.colorSpace = THREE.SRGBColorSpace
        material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: false,
        })
      } else if (data.videoPosterUrl) {
        const video = document.createElement('video')
        video.src = data.videoPosterUrl
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.setAttribute('playsinline', '')
        const tex = new THREE.VideoTexture(video)
        tex.colorSpace = THREE.SRGBColorSpace
        material = new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
        })
        video.addEventListener('loadeddata', () => {
          video.play().catch(() => {})
        })
        videoEl = video
        videoTex = tex
      } else {
        material = new THREE.MeshBasicMaterial({
          color: 0x2d3a2d,
          side: THREE.DoubleSide,
        })
      }

      const mesh = new THREE.Mesh(geometry, material)
      const tiltX = (Math.random() - 0.5) * 0.1
      const tiltZ = (Math.random() - 0.5) * 0.05

      mesh.userData = {
        nodeData: data,
        baseY: 0,
        videoEl,
        videoTexture: videoTex,
        tiltX,
        tiltZ,
      }

      const borderGeometry = new THREE.EdgesGeometry(geometry)
      const borderMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
      })
      const border = new THREE.LineSegments(borderGeometry, borderMaterial)
      border.position.z = 0.01
      mesh.add(border)
      const borderBack = new THREE.LineSegments(borderGeometry, borderMaterial.clone())
      borderBack.position.z = -0.01
      mesh.add(borderBack)

      this.nodes.push(mesh)
      this.group.add(mesh)
    })
  }

  setupEventListeners() {
    this.clickStartX = 0
    this.clickStartY = 0
    this.clickThreshold = 5

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.clickStartX = e.clientX
        this.clickStartY = e.clientY
      }
    })

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.visible) {
        const dx = Math.abs(e.clientX - this.clickStartX)
        const dy = Math.abs(e.clientY - this.clickStartY)
        if (dx < this.clickThreshold && dy < this.clickThreshold) {
          this.onClick(e)
        }
      }
    })

    if (this.popupClose) {
      this.popupClose.addEventListener('click', () => this.closePopup())
    }

    if (this.popup) {
      this.popup.addEventListener('click', (e) => {
        if (e.target === this.popup) {
          this.closePopup()
        }
      })
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popup?.classList.contains('is-visible')) {
        this.closePopup()
      }
    })
  }

  isInteractionBlocked() {
    const nav = this.experience.navigation
    if (!nav) return false
    if (this.experience.isTransitioning || nav.isSceneTransitioning || nav.welcomeShown || nav.exitConfirmationShown) return true
    if (document.getElementById('video-popup')?.classList.contains('is-visible')) return true
    if (document.getElementById('artwork-popup')?.classList.contains('is-visible')) return true
    if (document.getElementById('scene-welcome')?.classList.contains('is-visible')) return true
    if (document.getElementById('livestream-info-modal')?.classList.contains('is-visible')) return true
    if (document.querySelector('.exit-confirmation')?.classList.contains('is-visible')) return true
    if (document.getElementById('exhibition-overview')?.classList.contains('is-visible')) return true
    if (document.getElementById('exhibition-entry')?.classList.contains('is-visible')) return true
    if (document.getElementById('showcase-entry')?.classList.contains('is-visible')) return true
    return false
  }

  isInCorrespondingSpace() {
    return this.camera?.mode === 'showcaseOrbit'
  }

  onClick(event) {
    if (!this.visible) return
    if (!this.isInCorrespondingSpace()) return
    if (this.isInteractionBlocked()) return

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera.instance)
    const intersects = this.raycaster.intersectObjects(this.nodes, true)

    if (intersects.length > 0) {
      let targetMesh = intersects[0].object
      while (targetMesh && !targetMesh.userData?.nodeData) {
        targetMesh = targetMesh.parent
      }
      if (targetMesh?.userData?.nodeData) {
        this.openPopup(targetMesh.userData.nodeData)
      }
    }
  }

  openPopup(data) {
    if (!this.popup) return
    if (!this.isInCorrespondingSpace()) return
    if (this.isInteractionBlocked()) return

    pausePopupMedia(this.popupMediaStack)
    if (this.popupMediaStack) {
      this.popupMediaStack.innerHTML = ''
      const primary = data.primaryFile
      const ordered = [...(data.media || [])].sort((a, b) => {
        if (a.file === primary) return -1
        if (b.file === primary) return 1
        return 0
      })
      for (const item of ordered) {
        const block = document.createElement('div')
        block.className = 'artwork-popup-media-block'
        if (item.type === 'image') {
          const img = document.createElement('img')
          img.className = 'artwork-popup-media-item'
          img.src = item.url
          img.alt = formatMediaLabel(item.file)
          img.loading = 'lazy'
          block.appendChild(img)
        } else if (item.type === 'video') {
          const v = document.createElement('video')
          v.className = 'artwork-popup-media-item'
          v.controls = true
          v.playsInline = true
          v.setAttribute('playsinline', '')
          v.preload = 'metadata'
          v.src = item.url
          block.appendChild(v)
        } else if (item.type === 'audio') {
          const cap = document.createElement('div')
          cap.className = 'artwork-popup-media-caption'
          cap.textContent = formatMediaLabel(item.file)
          const au = document.createElement('audio')
          au.className = 'artwork-popup-media-item artwork-popup-media-audio'
          au.controls = true
          au.preload = 'metadata'
          au.src = item.url
          block.appendChild(cap)
          block.appendChild(au)
        } else if (item.type === 'pdf') {
          const iframe = document.createElement('iframe')
          iframe.className = 'artwork-popup-media-item artwork-popup-media-pdf'
          iframe.title = formatMediaLabel(item.file)
          iframe.src = item.url
          block.appendChild(iframe)
        }
        this.popupMediaStack.appendChild(block)
      }
    }

    if (this.popupTitle) this.popupTitle.textContent = data.title
    if (this.popupArtist) this.popupArtist.textContent = 'Natural Resonance · All We Can Save · Roots'
    if (this.popupDescription) {
      this.popupDescription.innerHTML = ''
      const artistLine = document.createElement('p')
      artistLine.className = 'artwork-popup-text-intro'
      artistLine.textContent = data.artist
      this.popupDescription.appendChild(artistLine)
      this.appendArtistTextSection(this.popupDescription, 'Statement of work', data.artistStatement, {
        dividerAfter: true,
      })
      this.appendArtistTextSection(this.popupDescription, 'Bio', data.bio, { dividerAfter: true })
      if (!data.artistStatement && !data.bio) {
        const p = document.createElement('p')
        p.className = 'artwork-popup-text-intro'
        p.textContent = 'Statement and biography will appear here when added to the AWCS sheet.'
        this.popupDescription.appendChild(p)
      }
    }

    this.popup.classList.add('is-visible')
    if (this.experience.navigation) {
      this.experience.navigation.enabled = false
    }
  }

  closePopup() {
    if (!this.popup) return

    pausePopupMedia(this.popupMediaStack)
    if (this.popupMediaStack) this.popupMediaStack.innerHTML = ''
    if (this.popupDescription) this.popupDescription.innerHTML = ''

    this.popup.classList.remove('is-visible')

    if (this.experience.navigation) {
      this.experience.navigation.enabled = true
    }
  }

  show() {
    this.visible = true
    this.group.visible = true
  }

  hide() {
    this.visible = false
    this.group.visible = false
    this.closePopup()
  }

  update() {
    if (!this.visible) return

    const time = Date.now() * 0.001 * this.nodeSettings.floatSpeed
    this.nodes.forEach((node, index) => {
      const offset = index * 0.5
      const baseY = node.userData.baseY ?? this.nodeSettings.baseHeight
      node.position.y = baseY + Math.sin(time + offset) * this.nodeSettings.floatAmplitude
      if (node.userData.videoTexture) {
        node.userData.videoTexture.needsUpdate = true
      }
    })

    this.updateConnectingLines()
  }

  dispose() {
    this.nodes.forEach((node) => {
      const v = node.userData?.videoEl
      if (v) {
        try {
          v.pause()
          v.removeAttribute('src')
          v.load()
        } catch {
          /* ignore */
        }
      }
      const mat = node.material
      if (node.userData?.videoTexture) {
        node.userData.videoTexture.dispose()
      } else if (mat?.map) {
        mat.map.dispose()
      }
      mat?.dispose()
      node.geometry?.dispose()
    })
    this.scene.remove(this.group)
  }
}
