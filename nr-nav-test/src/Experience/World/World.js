import Experience from '../Experience.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Player from './Player.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.resources = this.experience.resources

    this.resources.on('ready', () => this.onReady())
    if (this.resources.toLoad === 0) this.onReady()
  }

  onReady() {
    this.floor = new Floor()
    this.environment = new Environment()
    this.player = new Player()
  }

  update() {
    if (this.player?.update) this.player.update()
  }

  dispose() {
    this.floor?.dispose()
    this.environment?.dispose()
    this.player?.dispose()
  }
}
