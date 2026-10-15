import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class Trees {
  constructor(scene, options = {}) {
    this.scene = scene
    this.modelPath = options.modelPath || '/assets/tree_toon_1.glb'
    this.position = options.position || new THREE.Vector3(-2.1, -2.95, -0.5)
    this.targetSize = options.scale || 1.2

    this.active = false
    this.currentScale = 0
    this.targetScale = 0
    this.treeGroup = null

    this.init()
  }

  init() {
    const loader = new GLTFLoader()
    loader.load(
      this.modelPath,
      (gltf) => {
        this.treeGroup = gltf.scene
        this.treeGroup.position.copy(this.position)
        this.treeGroup.scale.set(0, 0, 0)

        this.treeGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = false

            const oldMat = child.material
            if (oldMat) {
              // 1. Obtenemos la textura base del modelo original
              const baseTexture = oldMat.map

              // 2. Reemplazamos el material por uno nuevo libre de AlphaHash/Dithering
              child.material = new THREE.MeshBasicMaterial({
                map: baseTexture,
                color: oldMat.color || 0xffffff,
                transparent: false, // 🔴 Apaga la mezcla de transparencia
                alphaTest: 0.5, // 🟢 Recorta los píxeles transparentes
                depthWrite: true, // 🟢 Escribe profundidad en el Z-buffer
                depthTest: true,
                side: THREE.DoubleSide, // Permite ver las hojas por ambos lados
              })

              // Desactivar explícitamente banderas de dithering
              child.material.alphaHash = false
              child.material.dither = false
            }
          }
        })

        this.treeGroup.visible = false
        this.scene.add(this.treeGroup)
      },
      undefined,
      (err) => console.error(`Error cargando modelo ${this.modelPath}:`, err),
    )
  }

  setActive(state) {
    this.active = state
    this.targetScale = state ? this.targetSize : 0.0
    if (state && this.treeGroup) {
      this.treeGroup.visible = true
    }
  }

  update() {
    if (!this.treeGroup) return

    if (Math.abs(this.currentScale - this.targetScale) > 0.001) {
      this.currentScale += (this.targetScale - this.currentScale) * 0.1
      this.treeGroup.scale.setScalar(this.currentScale)

      if (this.currentScale <= 0.01) {
        this.treeGroup.visible = false
      }
    }
  }
}
