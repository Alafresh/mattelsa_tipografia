import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class Bird {
  /**
   * @param {THREE.Scene} scene - Escena de Three.js
   * @param {Object} options - Configuración de posición, vuelo y modelo
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.modelPath = options.modelPath || '/assets/Pajaro.glb'
    this.animationName = options.animationName || 'Fly'

    // Posición central sobre la letra L
    this.basePosition = options.position || new THREE.Vector3(1.8, 0.5, 0.0)
    this.targetSize = options.scale || 0.6

    // Parámetros de trayectoria de vuelo
    this.radiusX = options.radiusX || 1.8
    this.radiusZ = options.radiusZ || 1.2
    this.flySpeed = options.flySpeed || 1.8
    this.waveSpeed = options.waveSpeed || 2.5
    this.waveAmplitude = options.waveAmplitude || 0.35

    this.active = false
    this.currentScale = 0
    this.targetScaleVal = 0
    this.angle = 0

    this.birdGroup = null
    this.mixer = null
    this.flyAction = null

    this.init()
  }

  init() {
    const loader = new GLTFLoader()
    loader.load(
      this.modelPath,
      (gltf) => {
        this.birdGroup = gltf.scene
        this.birdGroup.position.copy(this.basePosition)
        this.birdGroup.scale.set(0, 0, 0)

        // 1. Corrección de opacidad y habilitación de sombras
        this.birdGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true

            if (child.material) {
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material]
              materials.forEach((mat) => {
                mat.transparent = false // 🔴 Garantiza cuerpo opaco sin transparencias extrañas
                mat.depthWrite = true // 🟢 Corrección de Z-Buffer
                mat.depthTest = true
                mat.needsUpdate = true
              })
            }
          }
        })

        // 2. Configuración del AnimationMixer para la animación 'Fly'
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.birdGroup)

          // Buscar el clip por nombre o usar la primera animación disponible
          const clip =
            gltf.animations.find((a) => a.name === this.animationName) ||
            gltf.animations[0]

          if (clip) {
            this.flyAction = this.mixer.clipAction(clip)
            this.flyAction.play()
          }
        }

        this.birdGroup.visible = false
        this.scene.add(this.birdGroup)
      },
      undefined,
      (err) =>
        console.error(`Error al cargar el modelo ${this.modelPath}:`, err),
    )
  }

  /**
   * Activa o desactiva la presencia del pájaro con transición de escala LERP
   */
  setActive(state) {
    this.active = state
    this.targetScaleVal = state ? this.targetSize : 0.0
    if (state && this.birdGroup) {
      this.birdGroup.visible = true
    }
  }

  /**
   * Bucle de animación: Actualiza el mezclador de animaciones y la ruta de vuelo
   */
  update(delta) {
    if (!this.birdGroup) return

    // Actualizar animación del esqueleto del pájaro (aleteo de alas)
    if (this.mixer) {
      this.mixer.update(delta)
    }

    // Interpolación LERP de brote/aparición
    if (Math.abs(this.currentScale - this.targetScaleVal) > 0.001) {
      this.currentScale += (this.targetScaleVal - this.currentScale) * 0.1
      this.birdGroup.scale.setScalar(this.currentScale)

      if (this.currentScale <= 0.01) {
        this.birdGroup.visible = false
      }
    }

    if (!this.active && this.currentScale <= 0.01) return

    // Avance de vuelo orbital en 8 / Elipse sobre la letra L
    this.angle += delta * this.flySpeed

    const x = this.basePosition.x + Math.sin(this.angle) * this.radiusX
    const z = this.basePosition.z + Math.cos(this.angle) * this.radiusZ
    const y =
      this.basePosition.y +
      Math.sin(this.angle * this.waveSpeed) * this.waveAmplitude

    this.birdGroup.position.set(x, y, z)

    // Orientación dinámica: el pájaro mira en la dirección hacia la que vuela
    const nextX =
      this.basePosition.x + Math.sin(this.angle + 0.05) * this.radiusX
    const nextZ =
      this.basePosition.z + Math.cos(this.angle + 0.05) * this.radiusZ
    const nextY =
      this.basePosition.y +
      Math.sin((this.angle + 0.05) * this.waveSpeed) * this.waveAmplitude

    this.birdGroup.lookAt(nextX, nextY, nextZ)
  }
}
