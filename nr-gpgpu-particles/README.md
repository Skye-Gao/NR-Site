# GPGPU Flow Field Particles — Tree Effect

Experiment based on the [Three.js Journey GPGPU Flow Field Particles](https://threejs-journey.com/lessons/gpgpu-flow-field-particles-shaders) tutorial, adapted for a tree particle effect inspired by [Chartogne-Taillet](https://chartogne-taillet.com/en).

## Setup

```bash
npm install
npm run dev
```

## Adding Your Tree Model

1. Place your `.glb` model file in the `static/` folder (name it `model.glb` or update the path in `script.js`)
2. The model should be **low-poly** — each vertex becomes a particle
3. Recommended: paint vertex colors in Blender for natural tree coloring
4. Export from Blender as **glTF Binary (.glb)** with Draco compression

## Project Structure

```
nr-gpgpu-particles/
├── src/
│   ├── index.html
│   ├── style.css
│   ├── script.js              ← Main scene setup + animation loop
│   └── shaders/
│       ├── particles/
│       │   ├── vertex.glsl    ← Reads positions from GPGPU texture
│       │   └── fragment.glsl  ← Renders disc-shaped colored particles
│       └── gpgpu/
│           └── particles.glsl ← Flow field simulation (simplex noise)
├── static/                    ← Place model.glb and draco/ decoder here
├── package.json
├── vite.config.js
└── README.md
```

## Key Concepts

- **GPGPU**: Uses `GPUComputationRenderer` to store particle positions in an FBO texture
- **Flow Field**: 3D simplex noise generates directional streams that push particles
- **Persistence**: Each frame reads the previous frame's particle positions and updates them
- **Life Cycle**: Particles have a life value (alpha channel); when expired, they reset to their original position on the model
