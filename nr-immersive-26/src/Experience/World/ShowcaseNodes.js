import * as THREE from 'three'
import Experience from '../Experience.js'

export default class ShowcaseNodes {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.debug = this.experience.debug

    // Tree position reference
    this.treePosition = new THREE.Vector3(0, 0, -60)
    
    // Global node settings (adjustable via debug UI) - Underground positioning
    this.nodeSettings = {
      baseHeight: -8,         // Base Y position for nodes (underground)
      heightVariation: 5,     // Random height variation range
      orbitRadius: 10,        // Distance from tree center
      radiusVariation: 4,     // Variation in radius for organic spread
      baseScale: 0.7,         // Scale multiplier for all nodes
      floatAmplitude: 0.08,   // Subtle floating
      floatSpeed: 0.5         // Slower floating speed underground
    }
    
    // Node configuration - Showcase artworks (different from exhibition)
    this.nodes = []
    this.nodeData = [
      {
        id: 101,
        title: 'Underground Rivers',
        artist: 'Nina Torres',
        description: 'A journey through hidden waterways beneath ancient forests.',
        image: 'https://picsum.photos/seed/showcase1/400/500',
        size: { width: 2.2, height: 2.8 }
      },
      {
        id: 102,
        title: 'Mycelium Networks',
        artist: 'David Kim',
        description: 'Visualizing the invisible connections between trees.',
        image: 'https://picsum.photos/seed/showcase2/400/600',
        size: { width: 2, height: 3 }
      },
      {
        id: 103,
        title: 'Buried Seeds',
        artist: 'Amelia Hart',
        description: 'The patience of dormant life waiting to emerge.',
        image: 'https://picsum.photos/seed/showcase3/500/400',
        size: { width: 2.8, height: 2.2 }
      },
      {
        id: 104,
        title: 'Deep Time',
        artist: 'Marcus Webb',
        description: 'Geological layers tell stories of transformation.',
        image: 'https://picsum.photos/seed/showcase4/400/400',
        size: { width: 2.4, height: 2.4 }
      },
      {
        id: 105,
        title: 'Root Memory',
        artist: 'Sakura Ito',
        description: 'Ancient wisdom stored in the earth below.',
        image: 'https://picsum.photos/seed/showcase5/350/500',
        size: { width: 1.8, height: 2.6 }
      },
      {
        id: 106,
        title: 'Decomposition Dance',
        artist: 'Oliver Grant',
        description: 'The beautiful cycle of decay and renewal.',
        image: 'https://picsum.photos/seed/showcase6/450/350',
        size: { width: 2.6, height: 2 }
      }
    ]

    this.group = new THREE.Group()
    this.textureLoader = new THREE.TextureLoader()
    
    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    // Visibility
    this.visible = false
    
    // Popup elements (shared with exhibition)
    this.popup = document.getElementById('artwork-popup')
    this.popupTitle = document.getElementById('artwork-title')
    this.popupArtist = document.getElementById('artwork-artist')
    this.popupDescription = document.getElementById('artwork-description')
    this.popupImage = document.getElementById('artwork-image')
    this.popupClose = document.getElementById('artwork-popup-close')
    
    this.createNodes()
    this.updateNodePositions()
    this.createConnectingLines()  // Add white lines between nodes
    this.setupEventListeners()
    this.setupDebug()
    
    this.scene.add(this.group)
    this.group.visible = false
  }

  setupDebug() {
    if (!this.debug.ui) return
    
    const folder = this.debug.ui.addFolder('Showcase Nodes')
    folder.close()
    
    folder.add(this.nodeSettings, 'baseHeight').min(0).max(10).step(0.5).name('Base Height').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'heightVariation').min(0).max(5).step(0.5).name('Height Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'orbitRadius').min(5).max(20).step(0.5).name('Orbit Radius').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'radiusVariation').min(0).max(5).step(0.5).name('Radius Variation').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'baseScale').min(0.5).max(2).step(0.1).name('Base Scale').onChange(() => this.updateNodePositions())
    folder.add(this.nodeSettings, 'floatAmplitude').min(0).max(0.5).step(0.05).name('Float Amplitude')
    folder.add(this.nodeSettings, 'floatSpeed').min(0.1).max(3).step(0.1).name('Float Speed')
  }

  updateNodePositions() {
    const totalNodes = this.nodes.length
    
    this.nodes.forEach((mesh, index) => {
      const s = this.nodeSettings
      
      // Distribute nodes evenly around the tree in a circle
      const angleStep = (Math.PI * 2) / totalNodes
      const baseAngle = index * angleStep
      const angleVariation = (Math.sin(index * 1.7) * 0.3)
      const angle = baseAngle + angleVariation
      
      // Calculate radius with slight variation per node
      const radiusOffset = Math.sin(index * 2.3) * s.radiusVariation
      const radius = s.orbitRadius + radiusOffset
      
      // Position around tree center
      const x = Math.sin(angle) * radius
      const z = this.treePosition.z + Math.cos(angle) * radius
      
      // Height with variation (near ground level for roots)
      const heightOffset = Math.sin(index * 1.5) * s.heightVariation
      const y = s.baseHeight + heightOffset
      
      mesh.position.set(x, y, z)
      mesh.scale.setScalar(s.baseScale)
      
      // Make nodes face outward from tree center
      mesh.rotation.y = angle + Math.PI
      
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
      
      // Create frame geometry
      const geometry = new THREE.PlaneGeometry(data.size.width, data.size.height)
      
      // Create material with image - visible on both sides
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: false
      })

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material)
      
      // Add slight random tilt for organic feel
      mesh.rotation.x = (Math.random() - 0.5) * 0.1
      mesh.rotation.z = (Math.random() - 0.5) * 0.05
      
      // Store reference to data and base Y for animation
      mesh.userData = { 
        nodeData: data,
        baseY: 0
      }
      
      // Add white border/outline
      const borderGeometry = new THREE.EdgesGeometry(geometry)
      const borderMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        linewidth: 2
      })
      const border = new THREE.LineSegments(borderGeometry, borderMaterial)
      border.position.z = 0.01
      mesh.add(border)
      
      // Add border on the back side too
      const borderBack = new THREE.LineSegments(borderGeometry, borderMaterial.clone())
      borderBack.position.z = -0.01
      mesh.add(borderBack)
      
      this.nodes.push(mesh)
      this.group.add(mesh)
    })
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
    
    // Close popup handlers are shared with ExhibitionNodes
  }

  onClick(event) {
    if (!this.visible) return
    
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
    
    // Set content
    if (this.popupTitle) this.popupTitle.textContent = data.title
    if (this.popupArtist) this.popupArtist.textContent = `By ${data.artist}`
    if (this.popupDescription) this.popupDescription.textContent = data.description
    if (this.popupImage) this.popupImage.src = data.image
    
    // Show popup
    this.popup.classList.add('is-visible')
    
    // Disable navigation
    if (this.experience.navigation) {
      this.experience.navigation.enabled = false
    }
  }

  closePopup() {
    if (!this.popup) return
    
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
      const baseY = node.userData.baseY || this.nodeSettings.baseHeight
      node.position.y = baseY + Math.sin(time + offset) * this.nodeSettings.floatAmplitude
    })
    
    // Update connecting lines to follow nodes
    this.updateConnectingLines()
  }

  dispose() {
    this.nodes.forEach((node) => {
      node.geometry?.dispose()
      node.material?.dispose()
    })
    this.scene.remove(this.group)
  }
}
