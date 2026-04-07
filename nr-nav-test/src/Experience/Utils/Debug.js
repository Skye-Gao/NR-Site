import GUI from 'lil-gui'

export default class Debug {
  constructor() {
    this.active = true
    this.ui = new GUI()
    this.ui.hide()
    this.visible = false

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyG') {
        this.toggle()
      }
    })
  }

  toggle() {
    this.visible = !this.visible
    if (this.visible) {
      this.ui.show()
    } else {
      this.ui.hide()
    }
  }

  show() {
    this.visible = true
    this.ui.show()
  }

  hide() {
    this.visible = false
    this.ui.hide()
  }

  dispose() {
    if (this.ui) {
      this.ui.destroy()
    }
  }
}
