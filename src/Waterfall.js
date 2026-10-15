import * as THREE from 'three'

export class Waterfall {
  /**
   * @param {THREE.Scene} scene - Escena de Three.js
   * @param {Object} options - Configuración de dimensiones y posición
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.spawnHeight = options.spawnHeight || 8.5 // Origen en la parte superior
    this.floorY = options.floorY || -2.95 // Nivel del suelo
    this.width = options.width || 7.4 // Ancho de la cortina (de A a S)

    this.active = false
    this.progress = 0

    this.init()
  }

  init() {
    this.group = new THREE.Group()
    const height = this.spawnHeight - this.floorY

    // ----------------------------------------------------
    // 1. CARGA Y CONFIGURACIÓN DE LA TEXTURA WATER.JPG
    // ----------------------------------------------------
    const textureLoader = new THREE.TextureLoader()

    // Textura para la cortina vertical de la cascada
    this.curtainTexture = textureLoader.load('/assets/water.png')
    this.curtainTexture.wrapS = THREE.RepeatWrapping
    this.curtainTexture.wrapT = THREE.RepeatWrapping
    this.curtainTexture.repeat.set(3, 1) // Repetición horizontal y vertical

    // Textura clonada para el estanque del suelo
    this.poolTexture = textureLoader.load('/assets/water.png')
    this.poolTexture.wrapS = THREE.RepeatWrapping
    this.poolTexture.wrapT = THREE.RepeatWrapping
    this.poolTexture.repeat.set(2, 1)

    // ----------------------------------------------------
    // 2. MATERIALES BASADOS EN TEXTURA REAL
    // ----------------------------------------------------
    this.cascadeMaterial = new THREE.MeshBasicMaterial({
      map: this.curtainTexture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: this.poolTexture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    // ----------------------------------------------------
    // 3. CORTINA VERTICAL DE AGUA (DESDE LA 'A' HASTA LA 'S')
    // ----------------------------------------------------
    const cascadeGeo = new THREE.PlaneGeometry(this.width, height, 16, 16)
    // Trasladamos el pivote hacia arriba para que escale cayendo desde el techo
    cascadeGeo.translate(0, -height / 2, 0)

    this.cascadeMesh = new THREE.Mesh(cascadeGeo, this.cascadeMaterial)
    this.cascadeMesh.position.set(0, this.spawnHeight, 0)
    this.group.add(this.cascadeMesh)

    // ----------------------------------------------------
    // 4. ESTANQUE EN EL SUELO (CUBRE EL HUECO DEL PASTO)
    // ----------------------------------------------------
    const poolGeo = new THREE.PlaneGeometry(8.5, 3.2)
    this.poolMesh = new THREE.Mesh(poolGeo, this.poolMaterial)
    this.poolMesh.rotation.x = -Math.PI / 2
    this.poolMesh.position.set(0, this.floorY + 0.02, 0)
    this.group.add(this.poolMesh)

    this.group.visible = false
    this.scene.add(this.group)
  }

  setActive(state) {
    this.active = state
  }

  update(delta) {
    // Animación de aparición / desaparición suave
    if (this.active && this.progress < 1) {
      this.progress = Math.min(1, this.progress + delta * 2.2)
    } else if (!this.active && this.progress > 0) {
      this.progress = Math.max(0, this.progress - delta * 2.2)
    }

    if (this.progress <= 0) {
      this.group.visible = false
      return
    }

    this.group.visible = true

    // Cae desde arriba desplegando su altura
    const scaleY = THREE.MathUtils.lerp(0.001, 1.0, this.progress)
    this.cascadeMesh.scale.set(1, scaleY, 1)

    // Transparencia progresiva
    const opacity = this.progress * 0.88
    this.cascadeMaterial.opacity = opacity
    this.poolMaterial.opacity = opacity

    // 🌊 DESPLAZAMIENTO ANIMADO DE LA TEXTURA (UV SCROLLING)
    if (delta) {
      // Caída rápida del agua en la cortina vertical
      this.curtainTexture.offset.y += delta * 0.85

      // Movimiento suave del agua en el estanque
      this.poolTexture.offset.x += delta * 0.05
      this.poolTexture.offset.y += delta * 0.03
    }
  }
}
