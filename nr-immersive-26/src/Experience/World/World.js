import Experience from '../Experience.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Forest from './Forest.js'
import MainTree from './MainTree.js'
import Destinations from './Destinations.js'
import PanelTalkScene from './PanelTalkScene.js'
import LivestreamScene from './LivestreamScene.js'
import ExhibitionNodes from './ExhibitionNodes.js'
import ShowcaseNodes from './ShowcaseNodes.js'

export default class World {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.resources = this.experience.resources
    this.navigation = null  // Will be set after navigation is created

    this.resources.on('ready', () => this.onReady())
    if (this.resources.toLoad === 0) this.onReady()
    
    this.currentScene = null
  }

  onReady() {
    this.floor = new Floor()
    this.environment = new Environment()
    this.forest = new Forest()
    this.mainTree = new MainTree()
    this.destinations = new Destinations()
    this.panelTalkScene = new PanelTalkScene()
    this.livestreamScene = new LivestreamScene()
    this.exhibitionNodes = new ExhibitionNodes()
    this.showcaseNodes = new ShowcaseNodes()
    
    // Hide nodes initially
    if (this.exhibitionNodes) {
      this.exhibitionNodes.hide()
    }
    if (this.showcaseNodes) {
      this.showcaseNodes.hide()
    }
  }

  // Called by Navigation when entering/exiting scenes
  onEnterScene(sceneName) {
    if (sceneName === 'left' && this.panelTalkScene) {
      this.panelTalkScene.playVideos()
    }
    if (sceneName === 'right' && this.livestreamScene) {
      this.livestreamScene.playVideo()
    }
    this.currentScene = sceneName
  }

  onExitScene(sceneName) {
    if (sceneName === 'left' && this.panelTalkScene) {
      this.panelTalkScene.pauseVideos()
    }
    if (sceneName === 'right' && this.livestreamScene) {
      this.livestreamScene.pauseVideo()
    }
    this.currentScene = null
  }

  update() {
    if (this.floor?.update) this.floor.update()
    if (this.forest?.update) this.forest.update()
    if (this.mainTree?.update) this.mainTree.update()
    if (this.destinations?.update) this.destinations.update()
    if (this.panelTalkScene?.update) this.panelTalkScene.update()
    if (this.livestreamScene?.update) this.livestreamScene.update()
    if (this.exhibitionNodes?.update) this.exhibitionNodes.update()
    if (this.showcaseNodes?.update) this.showcaseNodes.update()
  }

  dispose() {
    this.floor?.dispose()
    this.environment?.dispose()
    this.forest?.dispose()
    this.mainTree?.dispose()
    this.destinations?.dispose()
    this.panelTalkScene?.dispose()
    this.livestreamScene?.dispose()
    this.exhibitionNodes?.dispose()
    this.showcaseNodes?.dispose()
  }
}
