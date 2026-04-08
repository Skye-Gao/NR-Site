import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import GUI from 'lil-gui'
import particlesVertexShader from './shaders/particles/vertex.glsl'
import particlesFragmentShader from './shaders/particles/fragment.glsl'
import gpgpuParticlesShader from './shaders/gpgpu/particles.glsl'

/**
 * Base
 */
const gui = new GUI({ width: 340 })
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()

/**
 * Lights
 *
 * Keep a basic lighting setup so imported GLTF assets are visible
 * before the GPGPU particle conversion is implemented.
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4)
directionalLight.position.set(5, 8, 6)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)

    if (particles) {
        particles.material.uniforms.uResolution.value.set(
            sizes.width * sizes.pixelRatio,
            sizes.height * sizes.pixelRatio
        )
    }
})

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4.5, 4, 11)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

const clearColor = '#29191f'
renderer.setClearColor(clearColor)
gui.addColor({ clearColor }, 'clearColor').onChange((value) => {
    renderer.setClearColor(value)
})

let particles = null
let gpgpu = null
let particlePositions = null
const samplingSettings = {
    surfaceCount: 35000,
    edgeCount: 18000,
    monochrome: false,
}
const dreamyColors = {
    trunkLow: '#1d5bff',
    trunkHigh: '#7dd3ff',
    canopyLow: '#7a62ff',
    canopyHigh: '#f3a9ff',
    sparkle: '#ffffff',
    canopyMixStart: 0.45,
    canopyMixEnd: 0.82,
    sparkleAmount: 0.08,
    hueWave: 0.15,
}

/**
 * Loaders
 */
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * Load model
 *
 * Place your .glb model in the static/ folder and update the path below.
 * The tutorial uses 'model.glb'. For a tree effect, place your tree model here.
 */
gltfLoader.load('/low_poly_tree/scene.gltf', (gltf) => {
    const modelData = extractModelData(gltf.scene, samplingSettings)
    const count = modelData.positions.length / 3

    if (count === 0) {
        console.error('Model has no mesh vertices to convert to particles.')
        return
    }

    // Fit the particle cloud into a consistent size.
    normalizePositions(modelData.positions, 3.5)

    gpgpu = createGPGPU(modelData.positions, renderer)
    particles = createParticles(count, gpgpu.size, modelData.colors)
    particlePositions = modelData.positions

    gui.add(particles.material.uniforms.uSize, 'value', 0.002, 0.08, 0.001).name('particleSize')
    gui.add(gpgpu.particlesVariable.material.uniforms.uDecaySpeed, 'value', 0.05, 1.5, 0.001).name('decaySpeed')
    gui.add(samplingSettings, 'surfaceCount', 5000, 120000, 1000).name('surfaceCount (reload)')
    gui.add(samplingSettings, 'edgeCount', 1000, 80000, 1000).name('edgeCount (reload)')
    gui.addColor(dreamyColors, 'trunkLow').name('trunkLow').onChange(updateDreamyColors)
    gui.addColor(dreamyColors, 'trunkHigh').name('trunkHigh').onChange(updateDreamyColors)
    gui.addColor(dreamyColors, 'canopyLow').name('canopyLow').onChange(updateDreamyColors)
    gui.addColor(dreamyColors, 'canopyHigh').name('canopyHigh').onChange(updateDreamyColors)
    gui.addColor(dreamyColors, 'sparkle').name('sparkle').onChange(updateDreamyColors)
    gui.add(dreamyColors, 'canopyMixStart', 0.0, 1.0, 0.001).name('canopyMixStart').onChange(updateDreamyColors)
    gui.add(dreamyColors, 'canopyMixEnd', 0.0, 1.0, 0.001).name('canopyMixEnd').onChange(updateDreamyColors)
    gui.add(dreamyColors, 'sparkleAmount', 0.0, 0.4, 0.001).name('sparkleAmount').onChange(updateDreamyColors)
    gui.add(dreamyColors, 'hueWave', 0.0, 0.5, 0.001).name('hueWave').onChange(updateDreamyColors)

    updateDreamyColors()

    const box = new THREE.Box3().setFromArray(modelData.positions)
    const size = box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z)
    const center = box.getCenter(new THREE.Vector3())
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const distance = (maxSize * 0.8) / Math.tan(fov * 0.5)
    camera.position.set(center.x + distance, center.y + distance * 0.35, center.z + distance)
    controls.target.copy(center)
    controls.update()

    console.log(`Particles ready: ${count}`)
}, undefined, (error) => {
    console.error('Failed to load model /low_poly_tree/scene.gltf', error)
})

function createGPGPU(positions, rendererInstance) {
    const count = positions.length / 3
    const size = Math.ceil(Math.sqrt(count))
    const compute = new GPUComputationRenderer(size, size, rendererInstance)
    const baseTexture = compute.createTexture()
    const data = baseTexture.image.data

    for (let i = 0; i < size * size; i++) {
        const i4 = i * 4
        const sourceIndex = (i % count) * 3
        data[i4 + 0] = positions[sourceIndex + 0]
        data[i4 + 1] = positions[sourceIndex + 1]
        data[i4 + 2] = positions[sourceIndex + 2]
        data[i4 + 3] = Math.random()
    }

    const particlesVariable = compute.addVariable('uParticles', gpgpuParticlesShader, baseTexture)
    compute.setVariableDependencies(particlesVariable, [particlesVariable])
    particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
    particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
    particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseTexture)
    particlesVariable.material.uniforms.uDecaySpeed = new THREE.Uniform(0.35)

    const initError = compute.init()
    if (initError) {
        console.error('GPUComputationRenderer init error:', initError)
    }

    return { compute, particlesVariable, size, count }
}

function createParticles(count, gpgpuSize, colors) {
    const particlesUvArray = new Float32Array(count * 2)
    const sizesArray = new Float32Array(count)
    const colorArray = new Float32Array(colors)

    for (let y = 0; y < gpgpuSize; y++) {
        for (let x = 0; x < gpgpuSize; x++) {
            const i = y * gpgpuSize + x
            if (i >= count) break

            const uvX = (x + 0.5) / gpgpuSize
            const uvY = (y + 0.5) / gpgpuSize
            particlesUvArray[i * 2] = uvX
            particlesUvArray[i * 2 + 1] = uvY

            sizesArray[i] = Math.random()
        }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setDrawRange(0, count)
    geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArray, 3))

    const material = new THREE.ShaderMaterial({
        vertexShader: particlesVertexShader,
        fragmentShader: particlesFragmentShader,
        uniforms: {
            uSize: new THREE.Uniform(0.07),
            uResolution: new THREE.Uniform(
                new THREE.Vector2(
                    sizes.width * sizes.pixelRatio,
                    sizes.height * sizes.pixelRatio
                )
            ),
            uParticlesTexture: new THREE.Uniform(null), // Will be set each frame from GPGPU output
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    return { geometry, material, points }
}

function extractModelData(root, settings) {
    const positions = []
    const colors = []

    root.updateWorldMatrix(true, true)
    const meshInfos = []

    root.traverse((child) => {
        if (!child.isMesh || !child.geometry || !child.geometry.getAttribute('position')) return

        const surfaceArea = computeSurfaceArea(child.geometry, child.matrixWorld)
        const edges = extractUniqueEdges(child.geometry, child.matrixWorld)
        const edgeLength = edges.reduce((sum, edge) => sum + edge.length, 0)
        const sampler = new MeshSurfaceSampler(child).build()
        const material = Array.isArray(child.material) ? child.material[0] : child.material

        meshInfos.push({
            child,
            sampler,
            surfaceArea,
            edges,
            edgeLength,
            material,
        })
    })

    const totalArea = meshInfos.reduce((sum, info) => sum + info.surfaceArea, 0) || 1
    const totalEdgeLength = meshInfos.reduce((sum, info) => sum + info.edgeLength, 0) || 1

    const sampledPosition = new THREE.Vector3()
    const sampledColor = new THREE.Color()

    // Surface points
    for (const info of meshInfos) {
        const count = Math.max(1, Math.round(settings.surfaceCount * (info.surfaceArea / totalArea)))
        for (let i = 0; i < count; i++) {
            info.sampler.sample(sampledPosition)
            sampledPosition.applyMatrix4(info.child.matrixWorld)
            positions.push(sampledPosition.x, sampledPosition.y, sampledPosition.z)

            if (settings.monochrome) {
                const jitter = 0.86 + Math.random() * 0.14
                colors.push(jitter, jitter, jitter)
            } else {
                const baseColor = info.material && info.material.color ? info.material.color : sampledColor.set('#a0cfa1')
                colors.push(baseColor.r, baseColor.g, baseColor.b)
            }
        }
    }

    // Edge points for sharper outlines
    for (const info of meshInfos) {
        if (!info.edges.length) continue
        const count = Math.max(1, Math.round(settings.edgeCount * (info.edgeLength / totalEdgeLength)))
        const cumulative = []
        let running = 0
        for (const edge of info.edges) {
            running += edge.length
            cumulative.push(running)
        }

        for (let i = 0; i < count; i++) {
            const target = Math.random() * running
            let edgeIndex = 0
            while (edgeIndex < cumulative.length && cumulative[edgeIndex] < target) edgeIndex++
            const edge = info.edges[Math.min(edgeIndex, info.edges.length - 1)]
            const t = Math.random()
            sampledPosition.copy(edge.a).lerp(edge.b, t)
            positions.push(sampledPosition.x, sampledPosition.y, sampledPosition.z)

            const edgeBrightness = 0.93 + Math.random() * 0.07
            colors.push(edgeBrightness, edgeBrightness, edgeBrightness)
        }
    }

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
    }
}

function computeSurfaceArea(geometry, matrixWorld) {
    const position = geometry.getAttribute('position')
    if (!position) return 0

    const index = geometry.getIndex()
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const ab = new THREE.Vector3()
    const ac = new THREE.Vector3()
    let area = 0

    const readVertex = (i, target) => {
        target.fromBufferAttribute(position, i).applyMatrix4(matrixWorld)
    }

    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            readVertex(index.getX(i + 0), a)
            readVertex(index.getX(i + 1), b)
            readVertex(index.getX(i + 2), c)
            ab.subVectors(b, a)
            ac.subVectors(c, a)
            area += ab.cross(ac).length() * 0.5
        }
    } else {
        for (let i = 0; i < position.count; i += 3) {
            readVertex(i + 0, a)
            readVertex(i + 1, b)
            readVertex(i + 2, c)
            ab.subVectors(b, a)
            ac.subVectors(c, a)
            area += ab.cross(ac).length() * 0.5
        }
    }

    return area
}

function extractUniqueEdges(geometry, matrixWorld) {
    const position = geometry.getAttribute('position')
    if (!position) return []

    const worldVertices = new Array(position.count)
    for (let i = 0; i < position.count; i++) {
        worldVertices[i] = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrixWorld)
    }

    const edgesMap = new Map()
    const addEdge = (ia, ib) => {
        const min = Math.min(ia, ib)
        const max = Math.max(ia, ib)
        const key = `${min}_${max}`
        if (edgesMap.has(key)) return
        const a = worldVertices[ia]
        const b = worldVertices[ib]
        const length = a.distanceTo(b)
        if (length > 0) edgesMap.set(key, { a, b, length })
    }

    const index = geometry.getIndex()
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const ia = index.getX(i + 0)
            const ib = index.getX(i + 1)
            const ic = index.getX(i + 2)
            addEdge(ia, ib)
            addEdge(ib, ic)
            addEdge(ic, ia)
        }
    } else {
        for (let i = 0; i < position.count; i += 3) {
            addEdge(i + 0, i + 1)
            addEdge(i + 1, i + 2)
            addEdge(i + 2, i + 0)
        }
    }

    return Array.from(edgesMap.values())
}

function normalizePositions(positions, targetSize) {
    const box = new THREE.Box3().setFromArray(positions)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z)
    const scale = maxSize > 0 ? targetSize / maxSize : 1

    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 0] = (positions[i + 0] - center.x) * scale
        positions[i + 1] = (positions[i + 1] - center.y) * scale
        positions[i + 2] = (positions[i + 2] - center.z) * scale
    }
}

function updateDreamyColors() {
    if (!particles || !particlePositions) return

    const colorAttr = particles.geometry.getAttribute('aColor')
    if (!colorAttr) return

    const trunkLow = new THREE.Color(dreamyColors.trunkLow)
    const trunkHigh = new THREE.Color(dreamyColors.trunkHigh)
    const canopyLow = new THREE.Color(dreamyColors.canopyLow)
    const canopyHigh = new THREE.Color(dreamyColors.canopyHigh)
    const sparkle = new THREE.Color(dreamyColors.sparkle)

    const box = new THREE.Box3().setFromArray(particlePositions)
    const minY = box.min.y
    const maxY = box.max.y
    const heightRange = Math.max(0.0001, maxY - minY)

    const c1 = new THREE.Color()
    const c2 = new THREE.Color()
    const final = new THREE.Color()

    for (let i = 0; i < colorAttr.count; i++) {
        const x = particlePositions[i * 3 + 0]
        const y = particlePositions[i * 3 + 1]
        const z = particlePositions[i * 3 + 2]
        const h = THREE.MathUtils.clamp((y - minY) / heightRange, 0, 1)

        const canopyT = THREE.MathUtils.smoothstep(h, dreamyColors.canopyMixStart, dreamyColors.canopyMixEnd)
        c1.copy(trunkLow).lerp(trunkHigh, h)
        c2.copy(canopyLow).lerp(canopyHigh, h)
        final.copy(c1).lerp(c2, canopyT)

        // Subtle shimmering hue variation along branches/canopy.
        const wave = Math.sin((x * 2.2 + z * 2.8 + y * 0.8) * 2.3) * dreamyColors.hueWave
        const hsl = { h: 0, s: 0, l: 0 }
        final.getHSL(hsl)
        final.setHSL((hsl.h + wave + 1) % 1, THREE.MathUtils.clamp(hsl.s + 0.06, 0, 1), hsl.l)

        // Random sparkles for dreamy glitter in canopy.
        const hash = fract(Math.sin((x * 12.9898) + (y * 78.233) + (z * 37.719)) * 43758.5453)
        if (hash < dreamyColors.sparkleAmount * (0.3 + h * 0.7)) {
            final.lerp(sparkle, 0.65)
        }

        colorAttr.setXYZ(i, final.r, final.g, final.b)
    }

    colorAttr.needsUpdate = true
}

function fract(value) {
    return value - Math.floor(value)
}

/**
 * Animation
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    controls.update()

    if (gpgpu && particles) {
        gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
        gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
        gpgpu.compute.compute()
        particles.material.uniforms.uParticlesTexture.value =
            gpgpu.compute.getCurrentRenderTarget(gpgpu.particlesVariable).texture
    }

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()
