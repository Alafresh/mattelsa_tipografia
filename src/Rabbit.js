import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class Rabbit {
  /**
   * @param {THREE.Scene} scene - Escena de Three.js
   * @param {Object} options - Opciones de configuración
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.modelPath = options.modelPath || '/assets/conejo.glb'
    this.texturePath = options.texturePath || '/assets/9.png'

    // Dimensiones de la órbita alrededor del origen (0,0,0)
    this.radiusX = options.radiusX || 8.5 // Ancho suficiente para rebasar la M y la A final
    this.radiusZ = options.radiusZ || 4.5 // Profundidad para girar al frente y atrás
    this.floorY = options.floorY || -2.95 // Nivel del piso
    this.targetSize = options.scale || 0.8 // Escala del modelo

    // Parámetros de salto y velocidad
    this.speed = options.speed || 1.2
    this.hopFrequency = options.hopFrequency || 5.0
    this.hopHeight = options.hopHeight || 0.9

    this.active = false
    this.currentScale = 0
    this.targetScaleVal = 0
    this.angle = 0
    this.rabbitGroup = null

    this.init()
  }

  init() {
    // Carga de la textura MatCap (11.png)
    const textureLoader = new THREE.TextureLoader()
    const matcapTexture = textureLoader.load(this.texturePath)

    const rabbitMatcapMaterial = new THREE.MeshMatcapMaterial({
      matcap: matcapTexture,
    })

    const loader = new GLTFLoader()
    loader.load(
      this.modelPath,
      (gltf) => {
        this.rabbitGroup = gltf.scene
        this.rabbitGroup.scale.set(0, 0, 0)

        // Asignación de material MatCap 11.png y sombras
        this.rabbitGroup.traverse((child) => {
          if (child.isMesh) {
            child.material = rabbitMatcapMaterial
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        this.rabbitGroup.visible = false
        this.scene.add(this.rabbitGroup)
      },
      undefined,
      (err) =>
        console.error(`Error al cargar el modelo ${this.modelPath}:`, err),
    )
  }

  /**
   * Activa o desactiva la presencia del conejo con transición de escala LERP
   */
  setActive(state) {
    this.active = state
    this.targetScaleVal = state ? this.targetSize : 0.0
    if (state && this.rabbitGroup) {
      this.rabbitGroup.visible = true
    }
  }

  /**
   * Bucle de animación: Movimiento de salto elíptico en torno al origen
   */
  update(delta) {
    if (!this.rabbitGroup) return

    // Interpolación LERP de brote/aparición
    if (Math.abs(this.currentScale - this.targetScaleVal) > 0.001) {
      this.currentScale += (this.targetScaleVal - this.currentScale) * 0.1
      this.rabbitGroup.scale.setScalar(this.currentScale)

      if (this.currentScale <= 0.01) {
        this.rabbitGroup.visible = false
      }
    }

    if (!this.active && this.currentScale <= 0.01) return

    // Avance continuo del ángulo orbital
    this.angle += delta * this.speed

    // Posicionamiento en elipse amplia alrededor de (0,0,0)
    const x = Math.sin(this.angle) * this.radiusX
    const z = Math.cos(this.angle) * this.radiusZ

    // Arco parabólico de salto
    const hopProgress = Math.abs(Math.sin(this.angle * this.hopFrequency))
    const y = this.floorY + hopProgress * this.hopHeight

    this.rabbitGroup.position.set(x, y, z)

    // Orientación dinámica: hace que el conejo mire hacia su dirección de avance
    const nextX = Math.sin(this.angle + 0.05) * this.radiusX
    const nextZ = Math.cos(this.angle + 0.05) * this.radiusZ
    this.rabbitGroup.lookAt(nextX, y, nextZ)
  }
}
