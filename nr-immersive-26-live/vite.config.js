import { defineConfig } from 'vite'

/** nr-immersive-26-live — sibling deploy of nr-immersive-26 */
export default defineConfig({
  // Match the "Three.js Journey" style:
  // - editable files live in `src/` (html, script, css)
  // - static assets live in `static/` (project root) and are served at `/`
  root: 'src',
  publicDir: '../static',
  build: {
    // Put output in project-root `dist/` (not `src/dist/`)
    outDir: '../dist',
    emptyOutDir: true,
  },
})
