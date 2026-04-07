import * as THREE from 'three'
import Experience from './Experience.js'

export default class Navigation {
  constructor() {
    this.experience = new Experience()
    this.camera = this.experience.camera
    this.debug = this.experience.debug

    this.enabled = true

    // Joystick state
    this.joystickActive = false
    this.joystickInput = { x: 0, y: 0 }
    this.joystickStartPos = { x: 0, y: 0 }
    this.joystickMaxRadius = 38
    this.lockedCameraAngle = 0  // Camera angle locked at press time

    // DOM elements
    this.joystickBase = document.getElementById('joystick-base')
    this.joystickKnob = document.getElementById('joystick-knob')

    this.setupJoystick()
  }

  setupJoystick() {
    if (!this.joystickKnob || !this.joystickBase) return

    const getBaseCenter = () => {
      const rect = this.joystickBase.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    }

    // Mouse events
    this.joystickKnob.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.joystickActive = true
      this.joystickKnob.classList.add('is-active')
      this.joystickStartPos = getBaseCenter()
      this.lockedCameraAngle = this.camera.currentAngle
    })

    window.addEventListener('mousemove', (e) => {
      if (!this.joystickActive) return

      const dx = e.clientX - this.joystickStartPos.x
      const dy = e.clientY - this.joystickStartPos.y
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), this.joystickMaxRadius)
      const angle = Math.atan2(dy, dx)

      const clampedX = Math.cos(angle) * distance
      const clampedY = Math.sin(angle) * distance

      this.joystickKnob.style.left = `calc(50% + ${clampedX}px)`
      this.joystickKnob.style.top = `calc(50% + ${clampedY}px)`

      this.joystickInput.x = clampedX / this.joystickMaxRadius
      this.joystickInput.y = clampedY / this.joystickMaxRadius
    })

    window.addEventListener('mouseup', () => {
      if (!this.joystickActive) return
      this.resetJoystick()
    })

    // Touch events
    this.joystickKnob.addEventListener('touchstart', (e) => {
      e.preventDefault()
      this.joystickActive = true
      this.joystickKnob.classList.add('is-active')
      this.joystickStartPos = getBaseCenter()
      this.lockedCameraAngle = this.camera.currentAngle
    })

    window.addEventListener('touchmove', (e) => {
      if (!this.joystickActive) return

      const touch = e.touches[0]
      const dx = touch.clientX - this.joystickStartPos.x
      const dy = touch.clientY - this.joystickStartPos.y
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), this.joystickMaxRadius)
      const angle = Math.atan2(dy, dx)

      const clampedX = Math.cos(angle) * distance
      const clampedY = Math.sin(angle) * distance

      this.joystickKnob.style.left = `calc(50% + ${clampedX}px)`
      this.joystickKnob.style.top = `calc(50% + ${clampedY}px)`

      this.joystickInput.x = clampedX / this.joystickMaxRadius
      this.joystickInput.y = clampedY / this.joystickMaxRadius
    })

    window.addEventListener('touchend', () => {
      if (!this.joystickActive) return
      this.resetJoystick()
    })
  }

  resetJoystick() {
    this.joystickActive = false
    this.joystickInput.x = 0
    this.joystickInput.y = 0
    this.joystickKnob.classList.remove('is-active')
    this.joystickKnob.style.left = '50%'
    this.joystickKnob.style.top = '50%'
  }

  update() {
    if (!this.enabled) return

    const player = this.experience.world?.player
    if (!player) return

    if (this.joystickActive) {
      // Joystick angle + camera angle locked at press time (prevents feedback loop)
      const joystickAngle = Math.atan2(this.joystickInput.x, -this.joystickInput.y)
      player.setDirection(joystickAngle + this.lockedCameraAngle)
    } else {
      player.stopMoving()
    }
  }

  dispose() {}
}
