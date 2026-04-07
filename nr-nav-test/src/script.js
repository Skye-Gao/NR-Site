import './style.css'
import Experience from './Experience/Experience.js'

const canvas = document.getElementById('webgl')
const experience = new Experience(canvas)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    experience.dispose()
  })
}
