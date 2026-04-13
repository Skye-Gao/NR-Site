import * as THREE from 'three'
import Experience from '../Experience.js'
import { WORLD_GROUND_LEVEL_Y } from './worldGroundLevel.js'
import galleryManifest from '../../data/galleryManifest.json'
import { galleryAssetUrl, formatMediaLabel, pausePopupMedia } from '../../data/galleryUrls.js'

export default class ExhibitionNodes {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.debug = this.experience.debug

    // Tree position reference
    this.treePosition = new THREE.Vector3(0, WORLD_GROUND_LEVEL_Y, -60)
    
    // Global node settings (adjustable via debug UI)
    this.nodeSettings = {
      baseHeight: 18,        // Base Y position for nodes
      heightVariation: 3,    // Random height variation range
      orbitRadius: 8,       // Distance from tree center (consistent for all nodes)
      radiusVariation: 2,    // Slight variation in radius
      baseScale: 0.9,        // Scale multiplier for all nodes
      floatAmplitude: 0.15,  // How much nodes float up/down
      floatSpeed: 1.0        // Speed of floating animation
    }
    
    this.nodes = []
    this.nodeData = this.buildNodeDataFromManifest()

    this.group = new THREE.Group()
    this.textureLoader = new THREE.TextureLoader()
    
    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    // Visibility
    this.visible = false
    
    // Popup elements
    this.popup = document.getElementById('artwork-popup')
    this.popupTitle = document.getElementById('artwork-title')
    this.popupArtist = document.getElementById('artwork-artist')
    this.popupDescription = document.getElementById('artwork-description')
    this.popupMediaStack = document.getElementById('artwork-media-stack')
    this.popupClose = document.getElementById('artwork-popup-close')
    
    this.createNodes()
    this.updateNodePositions()  // Apply nodeSettings to initial positions
    this.createConnectingLines()  // Add white lines between nodes
    this.setupEventListeners()
    this.setupDebug()
    
    this.scene.add(this.group)
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
    const base = galleryManifest.baseFolder
    return galleryManifest.artists
      .filter((a) => a.posterFile)
      .map((a, index) => ({
        id: index + 1,
        title: a.name,
        artist: a.name,
        image: galleryAssetUrl(base, a.folder, a.posterFile),
        folder: a.folder,
        media: a.media.map((m) => ({
          file: m.file,
          type: m.type,
          url: galleryAssetUrl(base, a.folder, m.file),
        })),
        artistStatement: (a.artistStatement || '').replace(/\r\n/g, '\n').trim(),
        bio: (a.bio || '').replace(/\r\n/g, '\n').trim(),
        position: new THREE.Vector3(0, 0, 0),
        rotation: 0,
        size: { width: 2.5, height: 3 },
      }))
  }

  setupDebug() {
    if (!this.debug.ui) return
    
    const folder = this.debug.ui.addFolder('Gallery (crown) nodes')
    folder.close()
    
    folder.add(this.nodeSettings, 'baseHeight').min(10).max(30).step(0.5).name('Base Height').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'heightVariation').min(0).max(10).step(0.5).name('Height Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'orbitRadius').min(5).max(25).step(0.5).name('Orbit Radius').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'radiusVariation').min(0).max(5).step(0.5).name('Radius Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'baseScale').min(0.5).max(2).step(0.1).name('Base Scale').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'floatAmplitude').min(0).max(0.5).step(0.05).name('Float Amplitude')
    folder.add(this.nodeSettings, 'floatSpeed').min(0.1).max(3).step(0.1).name('Float Speed')
  }

  updateNodePositions() {
    const totalNodes = this.nodes.length
    
    this.nodes.forEach((mesh, index) => {
      const data = this.nodeData[index]
      const s = this.nodeSettings
      
      // Distribute nodes evenly around the tree in a circle
      // Use a seeded variation based on index for consistent randomness
      const angleStep = (Math.PI * 2) / totalNodes
      const baseAngle = index * angleStep
      const angleVariation = (Math.sin(index * 1.7) * 0.3)  // Slight angle variation
      const angle = baseAngle + angleVariation
      
      // Calculate radius with slight variation per node
      const radiusOffset = Math.sin(index * 2.3) * s.radiusVariation
      const radius = s.orbitRadius + radiusOffset
      
      // Position around tree center
      const x = Math.sin(angle) * radius
      const z = this.treePosition.z + Math.cos(angle) * radius
      
      // Height with variation
      const heightOffset = Math.sin(index * 1.5) * s.heightVariation
      const y = s.baseHeight + heightOffset + WORLD_GROUND_LEVEL_Y
      
      mesh.position.set(x, y, z)
      mesh.scale.setScalar(s.baseScale)
      
      // Face the gallery plane outward (toward orbit camera), not toward the tree
      mesh.rotation.y = angle
      
      // Store base Y for floating animation
      mesh.userData.baseY = y
    })
    
    // Update connecting lines if they exist
    this.updateConnectingLines()
  }
  
  createConnectingLines() {
    this.linesGroup = new THREE.Group()
    this.lines = []
    
    // Create lines connecting nearby nodes
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3
    })
    
    // Connect each node to its neighbors and some cross-connections
    for (let i = 0; i < this.nodes.length; i++) {
      // Connect to next node (circular)
      const nextIndex = (i + 1) % this.nodes.length
      this.createLine(i, nextIndex, lineMaterial)
      
      // Connect to node across (for web effect)
      if (this.nodes.length > 4) {
        const acrossIndex = (i + Math.floor(this.nodes.length / 2)) % this.nodes.length
        this.createLine(i, acrossIndex, lineMaterial.clone())
      }
      
      // Some diagonal connections
      if (i % 2 === 0 && this.nodes.length > 3) {
        const diagIndex = (i + 2) % this.nodes.length
        this.createLine(i, diagIndex, lineMaterial.clone())
      }
    }
    
    this.group.add(this.linesGroup)
  }
  
  createLine(fromIndex, toIndex, material) {
    const points = [
      this.nodes[fromIndex].position.clone(),
      this.nodes[toIndex].position.clone()
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(geometry, material)
    line.userData = { fromIndex, toIndex }
    this.lines.push(line)
    this.linesGroup.add(line)
  }
  
  updateConnectingLines() {
    if (!this.lines) return
    
    this.lines.forEach(line => {
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
    this.nodeData.forEach((data, index) => {
      // Load texture
      const texture = this.textureLoader.load(data.image)
      texture.colorSpace = THREE.SRGBColorSpace
      
      // Create frame geometry - image fills the whole node
      const geometry = new THREE.PlaneGeometry(data.size.width, data.size.height)
      
      // Create material with image - visible on both sides
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: false
      })

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(data.position)
      mesh.rotation.y = data.rotation
      
      // Add slight random tilt for organic feel
      mesh.rotation.x = (Math.random() - 0.5) * 0.1
      mesh.rotation.z = (Math.random() - 0.5) * 0.05
      
      // Store reference to data and base Y for animation
      mesh.userData = { 
        nodeData: data,
        baseY: data.position.y
      }
      
      // Add white border/outline
      const borderGeometry = new THREE.EdgesGeometry(geometry)
      const borderMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        linewidth: 2
      })
      const border = new THREE.LineSegments(borderGeometry, borderMaterial)
      border.position.z = 0.01  // Slightly in front on one side
      mesh.add(border)
      
      // Add border on the back side too
      const borderBack = new THREE.LineSegments(borderGeometry, borderMaterial.clone())
      borderBack.position.z = -0.01  // Slightly in front on back side
      mesh.add(borderBack)
      
      this.nodes.push(mesh)
      this.group.add(mesh)
    })
  }

  getRandomAccentColor() {
    const colors = [
      0xff6b35, // Orange
      0xf7c331, // Yellow
      0x4ecdc4, // Teal
      0xff4757, // Red
      0x5f27cd, // Purple
      0x00d2d3, // Cyan
      0xff9f43, // Light orange
      0x2ed573  // Green
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  setupEventListeners() {
    // Click detection
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
    
    // Close popup
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
    return this.camera?.mode === 'exhibitionOrbit'
  }

  onClick(event) {
    if (!this.visible) return
    if (!this.isInCorrespondingSpace()) return
    if (this.isInteractionBlocked()) return
    
    // Calculate mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera.instance)
    
    // Check for intersections with nodes
    const intersects = this.raycaster.intersectObjects(this.nodes, true)
    
    if (intersects.length > 0) {
      // Find the parent mesh with node data
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
      for (const item of data.media || []) {
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
        }
        this.popupMediaStack.appendChild(block)
      }
    }

    if (this.popupTitle) this.popupTitle.textContent = data.title
    if (this.popupArtist) this.popupArtist.textContent = 'Natural Resonance · 2026 Gallery'
    if (this.popupDescription) {
      this.popupDescription.innerHTML = ''
      this.appendArtistTextSection(this.popupDescription, 'Artist statement', data.artistStatement, {
        dividerAfter: true,
      })
      this.appendArtistTextSection(this.popupDescription, 'Bio', data.bio, { dividerAfter: true })
      if (!data.artistStatement && !data.bio) {
        const p = document.createElement('p')
        p.className = 'artwork-popup-text-intro'
        p.textContent = 'Biography and statement will appear here when added.'
        this.popupDescription.appendChild(p)
      }
    }
    
    // Show popup
    this.popup.classList.add('is-visible')
    
    // Disable navigation
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
    
    // Re-enable navigation
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
    
    // Subtle floating animation for nodes
    const time = Date.now() * 0.001 * this.nodeSettings.floatSpeed
    this.nodes.forEach((node, index) => {
      const offset = index * 0.5
      const baseY = node.userData.baseY || this.nodeData[index].position.y
      node.position.y = baseY + Math.sin(time + offset) * this.nodeSettings.floatAmplitude
    })
    
    // Update connecting lines to follow nodes
    this.updateConnectingLines()
  }

  dispose() {
    this.nodes.forEach((node) => {
      const mat = node.material
      if (mat?.map) mat.map.dispose()
      node.geometry?.dispose()
      mat?.dispose()
    })
    this.scene.remove(this.group)
  }
}
