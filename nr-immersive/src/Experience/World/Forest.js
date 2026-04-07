import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Forest {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.debug = this.experience.debug

    this.treeCount = 250
    this.forestRadius = 80
    this.clearingRadius = 10
    
    // Scene positions for tree fade effect
    this.targetDistance = 60
    this.scenePositions = {
      left: new THREE.Vector3(
        -this.targetDistance * Math.sin(Math.PI * 2 / 3),
        0,
        -this.targetDistance * Math.cos(Math.PI * 2 / 3)
      ),
      right: new THREE.Vector3(
        -this.targetDistance * Math.sin(-Math.PI * 2 / 3),
        0,
        -this.targetDistance * Math.cos(-Math.PI * 2 / 3)
      )
    }
    
    // Fade settings
    this.fadeDistance = 50  // Distance from scene where trees start fading
    this.fadeRadius = 30    // Radius around camera path where trees fade

    this.createMaterials()
    this.createTrees()
    if (this.debug.active) this.setDebug()
  }

  createMaterials() {
    // Translucent materials
    this.trunkMaterial = new THREE.MeshStandardMaterial({
      color: '#4a3728',
      roughness: 0.9,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })

    this.branchMaterial = new THREE.MeshStandardMaterial({
      color: '#5a4030',
      roughness: 0.85,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })

    this.leavesMaterial = new THREE.MeshStandardMaterial({
      color: '#2d5a2d',
      roughness: 0.8,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
  }

  createTreeGeometry(scale = 1) {
    const tree = new THREE.Group()
    
    // Trunk
    const trunkHeight = 4 * scale
    const trunkGeometry = new THREE.CylinderGeometry(
      0.08 * scale, 
      0.2 * scale, 
      trunkHeight, 
      8
    )
    const trunk = new THREE.Mesh(trunkGeometry, this.trunkMaterial)
    trunk.position.y = trunkHeight / 2
    tree.add(trunk)

    // Main branches
    const branchCount = 2 + Math.floor(Math.random() * 3)
    const branchStartHeight = trunkHeight * 0.5
    
    for (let i = 0; i < branchCount; i++) {
      const branchAngle = (i / branchCount) * Math.PI * 2 + Math.random() * 0.5
      const branchLength = (1 + Math.random() * 1.5) * scale
      const branchHeight = branchStartHeight + Math.random() * trunkHeight * 0.4
      
      const branchGeometry = new THREE.CylinderGeometry(
        0.02 * scale,
        0.06 * scale,
        branchLength,
        6
      )
      const branch = new THREE.Mesh(branchGeometry, this.branchMaterial)
      
      branch.position.set(
        Math.cos(branchAngle) * 0.1 * scale,
        branchHeight,
        Math.sin(branchAngle) * 0.1 * scale
      )
      branch.rotation.z = Math.PI * 0.3 + Math.random() * 0.2
      branch.rotation.y = branchAngle
      branch.position.x += Math.cos(branchAngle) * branchLength * 0.3
      branch.position.z += Math.sin(branchAngle) * branchLength * 0.3
      
      tree.add(branch)

      // Multiple leaf clusters at branch end
      for (let j = 0; j < 2; j++) {
        const leafCluster = this.createLeafCluster(scale * (0.9 + Math.random() * 0.4))
        const offsetAngle = branchAngle + (Math.random() - 0.5) * 0.5
        leafCluster.position.set(
          Math.cos(offsetAngle) * branchLength * (0.6 + j * 0.2),
          branchHeight + branchLength * (0.2 + j * 0.15),
          Math.sin(offsetAngle) * branchLength * (0.6 + j * 0.2)
        )
        tree.add(leafCluster)
      }
    }

    // Top foliage clusters - more and bigger
    const topClusterCount = 6 + Math.floor(Math.random() * 4)
    for (let i = 0; i < topClusterCount; i++) {
      const cluster = this.createLeafCluster(scale * (0.8 + Math.random() * 0.7))
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 1.0 * scale
      const heightOffset = Math.random() * 2.0 * scale
      cluster.position.set(
        Math.cos(angle) * radius,
        trunkHeight - 0.5 + heightOffset,
        Math.sin(angle) * radius
      )
      tree.add(cluster)
    }
    
    // Extra dense center clusters
    for (let i = 0; i < 3; i++) {
      const cluster = this.createLeafCluster(scale * (1.0 + Math.random() * 0.5))
      cluster.position.set(
        (Math.random() - 0.5) * 0.4 * scale,
        trunkHeight + 0.3 + Math.random() * 0.8 * scale,
        (Math.random() - 0.5) * 0.4 * scale
      )
      tree.add(cluster)
    }

    return tree
  }

  createLeafCluster(size = 1) {
    const cluster = new THREE.Group()
    
    const clusterGeometry = new THREE.IcosahedronGeometry(size, 1)
    
    const positions = clusterGeometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      
      const noise = 0.7 + Math.random() * 0.6
      positions.setXYZ(i, x * noise, y * noise * 0.8, z * noise)
    }
    clusterGeometry.computeVertexNormals()
    
    // Create material with slight color variation
    const material = this.leavesMaterial.clone()
    const hue = 0.28 + Math.random() * 0.08
    const sat = 0.4 + Math.random() * 0.3
    const light = 0.2 + Math.random() * 0.15
    material.color.setHSL(hue, sat, light)
    material.opacity = 0.3 + Math.random() * 0.2
    
    const leaves = new THREE.Mesh(clusterGeometry, material)
    leaves.scale.y = 0.7
    cluster.add(leaves)
    
    return cluster
  }

  createTrees() {
    this.trees = new THREE.Group()
    this.treeData = []  // Store tree positions and materials for fading
    
    // Define exclusion zones in front of screens (no trees here)
    const exclusionZones = [
      // Panel Talk scene (left) - wide zone in front
      { center: this.scenePositions.left.clone(), radius: 20 },
      // Livestream scene (right) - wide zone in front
      { center: this.scenePositions.right.clone(), radius: 25 },
    ]
    
    // Also exclude the path from center to each scene
    const pathExclusionWidth = 8  // Width of path to keep clear
    
    let placedCount = 0
    const maxAttempts = this.treeCount * 3

    for (let i = 0; i < maxAttempts && placedCount < this.treeCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * this.forestRadius + 3

      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      const distanceFromCenter = Math.sqrt(x * x + z * z)
      if (distanceFromCenter < this.clearingRadius) continue
      
      // Check exclusion zones around screens
      let inExclusionZone = false
      for (const zone of exclusionZones) {
        const distToZone = Math.sqrt(
          Math.pow(x - zone.center.x, 2) + Math.pow(z - zone.center.z, 2)
        )
        if (distToZone < zone.radius) {
          inExclusionZone = true
          break
        }
      }
      if (inExclusionZone) continue
      
      // Check if on path from center to scenes
      for (const scenePos of Object.values(this.scenePositions)) {
        const dirToScene = new THREE.Vector2(scenePos.x, scenePos.z).normalize()
        const treePos2D = new THREE.Vector2(x, z)
        
        // Project tree position onto path direction
        const projLength = treePos2D.dot(dirToScene)
        
        // Only check if tree is between center and scene
        if (projLength > 0 && projLength < this.targetDistance) {
          // Calculate perpendicular distance to path
          const projPoint = dirToScene.clone().multiplyScalar(projLength)
          const perpDist = treePos2D.distanceTo(projPoint)
          
          if (perpDist < pathExclusionWidth) {
            inExclusionZone = true
            break
          }
        }
      }
      if (inExclusionZone) continue

      const scale = 0.8 + Math.random() * 1.2
      const tree = this.createTreeGeometry(scale)
      
      tree.position.set(x, 0, z)
      tree.rotation.y = Math.random() * Math.PI * 2
      
      // Store tree data for fading
      const materials = []
      tree.traverse((child) => {
        if (child.material && !materials.includes(child.material)) {
          materials.push(child.material)
        }
      })
      
      this.treeData.push({
        tree: tree,
        position: new THREE.Vector3(x, 0, z),
        materials: materials,
        baseOpacities: materials.map(m => m.opacity)
      })
      
      this.trees.add(tree)
      placedCount++
    }

    this.scene.add(this.trees)
  }

  setDebug() {
    const folder = this.debug.ui.addFolder('Forest')
    folder.addColor({ color: this.leavesMaterial.color.getHex() }, 'color')
      .name('Leaves').onChange((v) => this.leavesMaterial.color.set(v))
    folder.addColor({ color: this.trunkMaterial.color.getHex() }, 'color')
      .name('Trunk').onChange((v) => this.trunkMaterial.color.set(v))
    folder.add(this.leavesMaterial, 'opacity').min(0).max(1).step(0.01).name('Leaves Opacity')
    folder.add(this.trunkMaterial, 'opacity').min(0).max(1).step(0.01).name('Trunk Opacity')
  }

  update() {
    if (!this.camera || !this.camera.instance || !this.treeData) return
    
    const cameraPos = this.camera.instance.position
    const cameraPos2D = new THREE.Vector2(cameraPos.x, cameraPos.z)
    
    // Check distance to each scene
    for (const [sceneName, scenePos] of Object.entries(this.scenePositions)) {
      const scenePos2D = new THREE.Vector2(scenePos.x, scenePos.z)
      const distToScene = cameraPos2D.distanceTo(scenePos2D)
      
      // Only process if camera is approaching a scene
      if (distToScene < this.fadeDistance) {
        // Direction from origin to scene
        const dirToScene = scenePos2D.clone().normalize()
        
        // Fade trees that are between camera and scene
        this.treeData.forEach((data) => {
          const treePos2D = new THREE.Vector2(data.position.x, data.position.z)
          const distCameraToTree = cameraPos2D.distanceTo(treePos2D)
          
          // Check if tree is in front of camera (toward the scene)
          const cameraToTree = treePos2D.clone().sub(cameraPos2D)
          const cameraToScene = scenePos2D.clone().sub(cameraPos2D)
          
          // Dot product to check if tree is in front
          const dot = cameraToTree.dot(cameraToScene.normalize())
          
          // Tree is in front and close to camera
          if (dot > 0 && distCameraToTree < this.fadeRadius) {
            // Calculate fade amount based on distance (more aggressive fade)
            const fadeFactor = Math.pow(distCameraToTree / this.fadeRadius, 0.5)
            
            // Apply fade to materials
            data.materials.forEach((material, index) => {
              const baseOpacity = data.baseOpacities[index]
              material.opacity = baseOpacity * fadeFactor
            })
            
            // Hide tree earlier
            data.tree.visible = fadeFactor > 0.2
          }
        })
      }
    }
    
    // Restore trees that are not in fade zones
    this.treeData.forEach((data) => {
      const treePos2D = new THREE.Vector2(data.position.x, data.position.z)
      let inFadeZone = false
      
      for (const scenePos of Object.values(this.scenePositions)) {
        const scenePos2D = new THREE.Vector2(scenePos.x, scenePos.z)
        const distToScene = cameraPos2D.distanceTo(scenePos2D)
        
        if (distToScene < this.fadeDistance) {
          const distCameraToTree = cameraPos2D.distanceTo(treePos2D)
          const cameraToTree = treePos2D.clone().sub(cameraPos2D)
          const cameraToScene = scenePos2D.clone().sub(cameraPos2D)
          const dot = cameraToTree.dot(cameraToScene.normalize())
          
          if (dot > 0 && distCameraToTree < this.fadeRadius) {
            inFadeZone = true
            break
          }
        }
      }
      
      // Restore opacity if not in fade zone
      if (!inFadeZone) {
        data.materials.forEach((material, index) => {
          material.opacity = THREE.MathUtils.lerp(material.opacity, data.baseOpacities[index], 0.1)
        })
        data.tree.visible = true
      }
    })
  }

  dispose() {
    this.trees.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.scene.remove(this.trees)
  }
}
