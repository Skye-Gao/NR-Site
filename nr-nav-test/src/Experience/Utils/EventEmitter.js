export default class EventEmitter {
  constructor() {
    this.callbacks = {}
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = []
    }
    this.callbacks[event].push(callback)
    return this
  }

  off(event, callback) {
    if (!this.callbacks[event]) return this
    if (callback) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback)
    } else {
      delete this.callbacks[event]
    }
    return this
  }

  trigger(event, ...args) {
    if (!this.callbacks[event]) return this
    for (const callback of this.callbacks[event]) {
      callback(...args)
    }
    return this
  }

  dispose() {
    this.callbacks = {}
  }
}
