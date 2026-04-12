import * as THREE from 'three'
import Experience from '../Experience.js'
import { WORLD_GROUND_LEVEL_Y } from './worldGroundLevel.js'

export default class MainTree {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    // Tree position - front vertex of equilateral triangle (60 units from center)
    this.treePosition = new THREE.Vector3(0, WORLD_GROUND_LEVEL_Y, -60)

    this.sectionPoints = {
      showcase: new THREE.Vector3(0, -10, -60),   // Underground - Special Showcase (roots)
      exhibition: new THREE.Vector3(0, 16, -60),  // Top section - Gallery (crown)
    }

    this.group = new THREE.Group()
    this.group.position.copy(this.treePosition)
    
    this.createMaterials()
    this.createTrunk()
    this.createRoots()
    this.createUndergroundRootSystem()  // Complex underground root network
    this.createBranches()
    this.createCrown()

    this.scene.add(this.group)
    if (this.debug.active) this.setDebug()
  }

  createMaterials() {
    // Translucent materials
    this.trunkMaterial = new THREE.MeshStandardMaterial({
      color: '#3d2817',
      roughness: 0.95,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    })

    this.rootMaterial = new THREE.MeshStandardMaterial({
      color: '#2d1f12',
      roughness: 0.9,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })

    this.branchMaterial = new THREE.MeshStandardMaterial({
      color: '#5a3d28',
      roughness: 0.85,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })

    this.foliageMaterial = new THREE.MeshStandardMaterial({
      color: '#1a4a1a',
      roughness: 0.8,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
  }

  createTrunk() {
    const trunkHeight = 16
    const trunkSegments = 12
    
    const trunkGeometry = new THREE.CylinderGeometry(0.6, 1.8, trunkHeight, 16, trunkSegments)
    
    // Add organic variation
    const positions = trunkGeometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      
      const noise = Math.sin(y * 2) * 0.1 + Math.sin(y * 5 + x * 3) * 0.05
      const factor = 1 + noise
      positions.setX(i, x * factor)
      positions.setZ(i, z * factor)
    }
    trunkGeometry.computeVertexNormals()
    
    this.trunk = new THREE.Mesh(trunkGeometry, this.trunkMaterial)
    this.trunk.position.y = trunkHeight / 2
    this.group.add(this.trunk)
    
    this.trunkGeometry = trunkGeometry
  }

  createRoots() {
    this.roots = new THREE.Group()

    const rootCount = 10
    for (let i = 0; i < rootCount; i++) {
      const angle = (i / rootCount) * Math.PI * 2 + Math.random() * 0.3
      const rootLength = 2.5 + Math.random() * 2
      
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(
          Math.cos(angle) * 1.5, 
          0.2, 
          Math.sin(angle) * 1.5
        ),
        new THREE.Vector3(
          Math.cos(angle) * rootLength, 
          -0.3 + Math.random() * 0.3, 
          Math.sin(angle) * rootLength
        ),
        new THREE.Vector3(
          Math.cos(angle) * (rootLength + 1), 
          -0.8, 
          Math.sin(angle) * (rootLength + 1)
        ),
      ])
      
      const rootGeometry = new THREE.TubeGeometry(curve, 12, 0.15 + Math.random() * 0.15, 8, false)
      const root = new THREE.Mesh(rootGeometry, this.rootMaterial)
      this.roots.add(root)
      
      // Tendrils
      if (Math.random() > 0.5) {
        const tendrilAngle = angle + (Math.random() - 0.5) * 0.8
        const tendrilCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(
            Math.cos(angle) * 2, 
            0, 
            Math.sin(angle) * 2
          ),
          new THREE.Vector3(
            Math.cos(tendrilAngle) * 3, 
            -0.5, 
            Math.sin(tendrilAngle) * 3
          ),
        ])
        const tendrilGeometry = new THREE.TubeGeometry(tendrilCurve, 6, 0.05, 6, false)
        const tendril = new THREE.Mesh(tendrilGeometry, this.rootMaterial)
        this.roots.add(tendril)
      }
    }

    this.group.add(this.roots)
  }

  createUndergroundRootSystem() {
    this.undergroundRoots = new THREE.Group()
    
    // Create particle-based root system for the underground space
    const particleCount = 80000
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    
    // Root parameters
    const maxDepth = -25  // How deep the roots go
    const maxSpread = 20  // How wide the roots spread
    
    // Generate main root branches as curves, then scatter particles along them
    const rootPaths = []
    const mainRootCount = 12
    
    // Create main root paths
    for (let i = 0; i < mainRootCount; i++) {
      const angle = (i / mainRootCount) * Math.PI * 2 + Math.random() * 0.3
      const path = this.generateRootPath(angle, maxDepth, maxSpread)
      rootPaths.push(path)
      
      // Create secondary roots branching off
      const secondaryCount = 3 + Math.floor(Math.random() * 4)
      for (let j = 0; j < secondaryCount; j++) {
        const branchPoint = 0.2 + Math.random() * 0.6
        const basePos = path.getPoint(branchPoint)
        const branchAngle = angle + (Math.random() - 0.5) * 1.5
        const secondaryPath = this.generateSecondaryRootPath(basePos, branchAngle, maxDepth * 0.7)
        rootPaths.push(secondaryPath)
        
        // Tertiary roots (fine detail)
        const tertiaryCount = 2 + Math.floor(Math.random() * 3)
        for (let k = 0; k < tertiaryCount; k++) {
          const tertiaryBranchPoint = 0.3 + Math.random() * 0.5
          const tertiaryBase = secondaryPath.getPoint(tertiaryBranchPoint)
          const tertiaryAngle = branchAngle + (Math.random() - 0.5) * 2
          const tertiaryPath = this.generateTertiaryRootPath(tertiaryBase, tertiaryAngle)
          rootPaths.push(tertiaryPath)
        }
      }
    }
    
    // Distribute particles along root paths with density falloff
    let particleIndex = 0
    const particlesPerPath = Math.floor(particleCount / rootPaths.length)
    
    rootPaths.forEach((path, pathIndex) => {
      const isMainRoot = pathIndex < mainRootCount
      const density = isMainRoot ? 1.5 : 0.8
      const pathParticles = Math.floor(particlesPerPath * density)
      
      for (let i = 0; i < pathParticles && particleIndex < particleCount; i++) {
        const t = Math.random()
        const point = path.getPoint(t)
        
        // Add noise/scatter around the path
        const scatter = isMainRoot ? 0.8 : 0.4
        const depthFactor = Math.abs(point.y) / Math.abs(maxDepth)
        const scatterAmount = scatter * (0.5 + depthFactor * 0.5)
        
        positions[particleIndex * 3] = point.x + (Math.random() - 0.5) * scatterAmount
        positions[particleIndex * 3 + 1] = point.y + (Math.random() - 0.5) * scatterAmount * 0.5
        positions[particleIndex * 3 + 2] = point.z + (Math.random() - 0.5) * scatterAmount
        
        // Color variation - earthy brown/grey tones
        const brightness = 0.5 + Math.random() * 0.5
        const rootColor = new THREE.Color()
        rootColor.setHSL(0.08 + Math.random() * 0.04, 0.2 + Math.random() * 0.15, brightness * 0.4)
        
        colors[particleIndex * 3] = rootColor.r
        colors[particleIndex * 3 + 1] = rootColor.g
        colors[particleIndex * 3 + 2] = rootColor.b
        
        // Size based on depth and root type
        sizes[particleIndex] = isMainRoot ? 
          0.08 + Math.random() * 0.12 : 
          0.04 + Math.random() * 0.08
        
        particleIndex++
      }
    })
    
    // Add scattered fine root particles for atmosphere
    while (particleIndex < particleCount) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * maxSpread
      const depth = -Math.random() * Math.abs(maxDepth) * 0.8
      
      // Density decreases with distance from center and depth
      const distFactor = radius / maxSpread
      if (Math.random() > distFactor * 0.7) {
        positions[particleIndex * 3] = Math.cos(angle) * radius
        positions[particleIndex * 3 + 1] = depth
        positions[particleIndex * 3 + 2] = Math.sin(angle) * radius
        
        const brightness = 0.3 + Math.random() * 0.4
        colors[particleIndex * 3] = brightness
        colors[particleIndex * 3 + 1] = brightness * 0.9
        colors[particleIndex * 3 + 2] = brightness * 0.8
        
        sizes[particleIndex] = 0.02 + Math.random() * 0.04
      }
      particleIndex++
    }
    
    // Create geometry and material
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    
    // Custom shader material for particles
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    
    const particles = new THREE.Points(geometry, material)
    this.undergroundRoots.add(particles)
    
    // Particle roots only - no tube geometry needed
    this.group.add(this.undergroundRoots)
  }
  
  generateRootPath(angle, maxDepth, maxSpread) {
    const points = []
    const segments = 6 + Math.floor(Math.random() * 4)
    
    // Start at trunk base
    points.push(new THREE.Vector3(0, 0, 0))
    
    // Generate path going down and outward
    let currentAngle = angle
    let currentRadius = 0
    let currentDepth = 0
    
    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      
      // Gradually spread outward and downward
      currentAngle += (Math.random() - 0.5) * 0.3
      currentRadius += (maxSpread / segments) * (0.8 + Math.random() * 0.4)
      currentDepth += (maxDepth / segments) * (0.7 + Math.random() * 0.6)
      
      points.push(new THREE.Vector3(
        Math.cos(currentAngle) * currentRadius,
        currentDepth,
        Math.sin(currentAngle) * currentRadius
      ))
    }
    
    return new THREE.CatmullRomCurve3(points)
  }
  
  generateSecondaryRootPath(startPos, angle, maxDepth) {
    const points = []
    const segments = 4 + Math.floor(Math.random() * 3)
    
    points.push(startPos.clone())
    
    let currentAngle = angle
    let currentRadius = Math.sqrt(startPos.x * startPos.x + startPos.z * startPos.z)
    let currentDepth = startPos.y
    
    for (let i = 1; i <= segments; i++) {
      currentAngle += (Math.random() - 0.5) * 0.5
      currentRadius += 1.5 + Math.random() * 2
      currentDepth -= 2 + Math.random() * 3
      currentDepth = Math.max(currentDepth, maxDepth)
      
      points.push(new THREE.Vector3(
        Math.cos(currentAngle) * currentRadius,
        currentDepth,
        Math.sin(currentAngle) * currentRadius
      ))
    }
    
    return new THREE.CatmullRomCurve3(points)
  }
  
  generateTertiaryRootPath(startPos, angle) {
    const points = []
    const length = 2 + Math.random() * 4
    
    points.push(startPos.clone())
    
    for (let i = 1; i <= 3; i++) {
      const t = i / 3
      points.push(new THREE.Vector3(
        startPos.x + Math.cos(angle) * length * t + (Math.random() - 0.5) * 0.5,
        startPos.y - length * t * 0.5,
        startPos.z + Math.sin(angle) * length * t + (Math.random() - 0.5) * 0.5
      ))
    }
    
    return new THREE.CatmullRomCurve3(points)
  }
  
  createMainRootTubes(mainPaths) {
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: '#3d2817',
      roughness: 0.9,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
    
    mainPaths.forEach((path, index) => {
      // Main root tubes with taper
      const startRadius = 0.4 + Math.random() * 0.3
      const segments = 20
      
      // Create custom geometry with tapering
      const points = path.getPoints(segments)
      for (let i = 0; i < points.length - 1; i++) {
        const t = i / (points.length - 1)
        const radius = startRadius * (1 - t * 0.8) // Taper to 20% of original size
        
        const tubeSegment = new THREE.CylinderGeometry(
          radius * 0.8, 
          radius, 
          points[i].distanceTo(points[i + 1]),
          8
        )
        
        const tube = new THREE.Mesh(tubeSegment, tubeMaterial)
        
        // Position and orient tube segment
        const midPoint = points[i].clone().add(points[i + 1]).multiplyScalar(0.5)
        tube.position.copy(midPoint)
        
        // Orient toward next point
        const direction = new THREE.Vector3().subVectors(points[i + 1], points[i]).normalize()
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        tube.quaternion.copy(quaternion)
        
        this.undergroundRoots.add(tube)
      }
    })
  }

  createBranches() {
    this.branches = new THREE.Group()

    const branchLayers = [
      { height: 8, count: 4, length: 4, thickness: 0.25 },
      { height: 10, count: 5, length: 5, thickness: 0.2 },
      { height: 12, count: 6, length: 4, thickness: 0.15 },
      { height: 14, count: 5, length: 3, thickness: 0.12 },
    ]

    branchLayers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const angle = (i / layer.count) * Math.PI * 2 + Math.random() * 0.5
        const length = layer.length * (0.8 + Math.random() * 0.4)
        
        const upwardAngle = 0.2 + Math.random() * 0.3
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, layer.height, 0),
          new THREE.Vector3(
            Math.cos(angle) * length * 0.4,
            layer.height + length * upwardAngle,
            Math.sin(angle) * length * 0.4
          ),
          new THREE.Vector3(
            Math.cos(angle) * length * 0.8,
            layer.height + length * upwardAngle * 1.2,
            Math.sin(angle) * length * 0.8
          ),
          new THREE.Vector3(
            Math.cos(angle) * length,
            layer.height + length * upwardAngle * 0.8,
            Math.sin(angle) * length
          ),
        ])

        const branchGeometry = new THREE.TubeGeometry(
          curve, 
          10, 
          layer.thickness * (0.8 + Math.random() * 0.4), 
          8, 
          false
        )
        const branch = new THREE.Mesh(branchGeometry, this.branchMaterial)
        this.branches.add(branch)

        // Secondary branches
        if (layer.height < 13 && Math.random() > 0.3) {
          const subAngle = angle + (Math.random() - 0.5) * 1.2
          const subLength = length * 0.5
          const subCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(
              Math.cos(angle) * length * 0.5,
              layer.height + length * upwardAngle * 0.6,
              Math.sin(angle) * length * 0.5
            ),
            new THREE.Vector3(
              Math.cos(subAngle) * (length * 0.5 + subLength),
              layer.height + length * upwardAngle + subLength * 0.3,
              Math.sin(subAngle) * (length * 0.5 + subLength)
            ),
          ])
          const subBranchGeometry = new THREE.TubeGeometry(subCurve, 6, layer.thickness * 0.4, 6, false)
          const subBranch = new THREE.Mesh(subBranchGeometry, this.branchMaterial)
          this.branches.add(subBranch)
        }
      }
    })

    this.group.add(this.branches)
  }

  createCrown() {
    this.crown = new THREE.Group()

    const clusterPositions = []
    
    // More layers with bigger radius and more clusters
    for (let layer = 0; layer < 6; layer++) {
      const layerHeight = 10 + layer * 2
      const layerRadius = 7 - layer * 0.7
      const clusterCount = 12 - layer * 1.2
      
      for (let i = 0; i < clusterCount; i++) {
        const angle = (i / clusterCount) * Math.PI * 2 + Math.random() * 0.5
        const radius = layerRadius * (0.6 + Math.random() * 0.5)
        clusterPositions.push({
          x: Math.cos(angle) * radius,
          y: layerHeight + Math.random() * 2,
          z: Math.sin(angle) * radius,
          size: 2.0 + Math.random() * 2.0 - layer * 0.15
        })
      }
      
      // Inner clusters for each layer
      const innerCount = Math.floor(clusterCount * 0.5)
      for (let i = 0; i < innerCount; i++) {
        const angle = (i / innerCount) * Math.PI * 2 + Math.random() * 0.8
        const radius = layerRadius * 0.3 * (0.5 + Math.random() * 0.5)
        clusterPositions.push({
          x: Math.cos(angle) * radius,
          y: layerHeight + 0.5 + Math.random() * 1.5,
          z: Math.sin(angle) * radius,
          size: 1.8 + Math.random() * 1.5
        })
      }
    }

    // Top clusters - bigger and more
    clusterPositions.push({ x: 0, y: 22, z: 0, size: 3 })
    clusterPositions.push({ x: 0.8, y: 21, z: 0.8, size: 2.5 })
    clusterPositions.push({ x: -0.8, y: 20.5, z: -0.5, size: 2.5 })
    clusterPositions.push({ x: 0.3, y: 21.5, z: -0.6, size: 2 })
    clusterPositions.push({ x: -0.5, y: 21, z: 0.7, size: 2.2 })
    
    // Dense center column
    for (let i = 0; i < 8; i++) {
      clusterPositions.push({
        x: (Math.random() - 0.5) * 2,
        y: 11 + i * 1.5 + Math.random(),
        z: (Math.random() - 0.5) * 2,
        size: 2.2 + Math.random() * 1.5
      })
    }

    clusterPositions.forEach(pos => {
      const cluster = this.createLeafCluster(pos.size)
      cluster.position.set(pos.x, pos.y, pos.z)
      cluster.rotation.y = Math.random() * Math.PI * 2
      this.crown.add(cluster)
    })

    this.group.add(this.crown)
  }

  createLeafCluster(size) {
    const geometry = new THREE.IcosahedronGeometry(size, 2)
    
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      
      const noise = 0.6 + Math.random() * 0.8
      positions.setXYZ(
        i, 
        x * noise, 
        y * noise * 0.7,
        z * noise
      )
    }
    geometry.computeVertexNormals()
    
    // Translucent material with color variation
    const material = this.foliageMaterial.clone()
    const hue = 0.28 + Math.random() * 0.06
    const sat = 0.4 + Math.random() * 0.25
    const light = 0.18 + Math.random() * 0.12
    material.color.setHSL(hue, sat, light)
    material.opacity = 0.3 + Math.random() * 0.2
    
    const cluster = new THREE.Mesh(geometry, material)
    return cluster
  }

  setDebug() {
    const folder = this.debug.ui.addFolder('Main Tree')
    folder.addColor({ color: this.trunkMaterial.color.getHex() }, 'color')
      .name('Trunk').onChange((v) => this.trunkMaterial.color.set(v))
    folder.addColor({ color: this.foliageMaterial.color.getHex() }, 'color')
      .name('Foliage').onChange((v) => this.foliageMaterial.color.set(v))
    folder.add(this.trunkMaterial, 'opacity').min(0).max(1).step(0.01).name('Trunk Opacity')
    folder.add(this.foliageMaterial, 'opacity').min(0).max(1).step(0.01).name('Foliage Opacity')
  }
  
  // Show only underground particle roots (hide tree model)
  showUndergroundOnly() {
    if (this.trunk) this.trunk.visible = false
    if (this.roots) this.roots.visible = false
    if (this.branches) this.branches.visible = false
    if (this.crown) this.crown.visible = false
    if (this.undergroundRoots) this.undergroundRoots.visible = true
  }
  
  // Show full tree (hide underground roots)
  showAboveGroundOnly() {
    if (this.trunk) this.trunk.visible = true
    if (this.roots) this.roots.visible = true
    if (this.branches) this.branches.visible = true
    if (this.crown) this.crown.visible = true
    if (this.undergroundRoots) this.undergroundRoots.visible = false
  }
  
  // Show everything
  showAll() {
    if (this.trunk) this.trunk.visible = true
    if (this.roots) this.roots.visible = true
    if (this.branches) this.branches.visible = true
    if (this.crown) this.crown.visible = true
    if (this.undergroundRoots) this.undergroundRoots.visible = true
  }

  update() {}

  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.scene.remove(this.group)
  }
}
