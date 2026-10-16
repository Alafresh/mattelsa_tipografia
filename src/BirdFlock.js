import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

export class BirdFlock {
  /**
   * @param {THREE.Scene} scene - Escena principal de Three.js
   * @param {Object} options - Parámetros de la bandada y física Boids
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.modelPath = options.modelPath || '/assets/Pajaro.glb'
    this.animationName = options.animationName || 'Fly'
    this.count = options.count || 12 // Cantidad de pájaros en el enjambre

    // Centro de atracción (Letra L)
    this.center = options.center || new THREE.Vector3(1.8, 1.2, 0.0)
    this.spawnRadius = options.spawnRadius || 2.5
    this.birdScale = options.scale || 0.35

    // --- PARÁMETROS BOIDS AL 100% ---
    this.maxSpeed = options.maxSpeed || 3.5
    this.maxForce = options.maxForce || 0.15

    // Distancias de percepción
    this.separationDist = options.separationDist || 3
    this.alignmentDist = options.alignmentDist || 3.2
    this.cohesionDist = options.cohesionDist || 6.5

    // Pesos del algoritmo de Flocking
    this.weightSeparation = 1.3
    this.weightAlignment = 1.0
    this.weightCohesion = 1.2
    this.weightCenterAttraction = 0.2

    // Estado del sistema
    this.active = false
    this.currentScale = 0
    this.targetScaleVal = 0

    // En el constructor de BirdFlock.js:
    this.minY = options.minY !== undefined ? options.minY : -0.5 // 👈 Altura mínima permitida (por encima del piso de la escena)
    this.weightFloorAvoidance = 3.0 // 👈 Fuerza intensa para hacer que remonten vuelo si se acercan al suelo

    this.flockGroup = new THREE.Group()
    this.birds = [] // Array de objetos { mesh, velocity, acceleration, mixer }
    this.scene.add(this.flockGroup)

    this.init()
  }

  init() {
    const loader = new GLTFLoader()
    loader.load(
      this.modelPath,
      (gltf) => {
        const baseScene = gltf.scene
        const clip =
          gltf.animations.find((a) => a.name === this.animationName) ||
          gltf.animations[0]

        // Preparar materiales y sombras en el modelo base
        baseScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = false

            if (child.material) {
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material]
              materials.forEach((mat) => {
                mat.transparent = false // 🔴 Garantiza cuerpo opaco sin transparencia de rayos X
                mat.depthWrite = true // 🟢 Oclusión perfecta en el Z-Buffer
                mat.depthTest = true
                mat.needsUpdate = true
              })
            }
          }
        })

        // Instanciar la cantidad deseada de pájaros
        for (let i = 0; i < this.count; i++) {
          // Clonación profunda del esqueleto para independientes animaciones de aleteo
          const birdMesh = SkeletonUtils.clone(baseScene)

          // Posicionamiento inicial aleatorio en una esfera alrededor de la letra L
          const pos = new THREE.Vector3(
            this.center.x + (Math.random() - 0.5) * this.spawnRadius * 2,
            this.center.y + (Math.random() - 0.5) * this.spawnRadius,
            this.center.z + (Math.random() - 0.5) * this.spawnRadius * 2,
          )
          birdMesh.position.copy(pos)
          birdMesh.scale.set(0, 0, 0)

          // Velocidad inicial aleatoria
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1,
            (Math.random() - 0.5) * 2,
          )
            .normalize()
            .multiplyScalar(Math.random() * this.maxSpeed)

          // Configurar mezclador de animación independiente
          let mixer = null
          if (clip) {
            mixer = new THREE.AnimationMixer(birdMesh)
            const action = mixer.clipAction(clip)
            // Desfase de tiempo aleatorio para aleteos asíncronos
            action.time = Math.random() * clip.duration
            action.play()
          }

          this.flockGroup.add(birdMesh)

          this.birds.push({
            mesh: birdMesh,
            position: birdMesh.position,
            velocity: velocity,
            acceleration: new THREE.Vector3(),
            mixer: mixer,
          })
        }

        this.flockGroup.visible = false
      },
      undefined,
      (err) =>
        console.error(
          `Error al cargar el modelo de bandada ${this.modelPath}:`,
          err,
        ),
    )
  }

  /**
   * Reinicia la posición, velocidad y aceleración de todas las aves al centro de origen
   */
  resetFlock() {
    this.birds.forEach((bird) => {
      // 1. Reposicionar en un punto aleatorio dentro del radio alrededor de la letra L
      const pos = new THREE.Vector3(
        this.center.x + (Math.random() - 0.5) * this.spawnRadius * 2,
        this.center.y + (Math.random() - 0.5) * this.spawnRadius,
        this.center.z + (Math.random() - 0.5) * this.spawnRadius * 2,
      )
      bird.position.copy(pos)
      bird.mesh.position.copy(pos)

      // 2. Reiniciar la velocidad con una dirección aleatoria fresca
      bird.velocity
        .set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1,
          (Math.random() - 0.5) * 2,
        )
        .normalize()
        .multiplyScalar(Math.random() * this.maxSpeed)

      // 3. Limpiar aceleraciones acumuladas
      bird.acceleration.set(0, 0, 0)
    })
  }

  /**
   * Activa/Desactiva la presencia de la bandada con LERP y reseteo de posiciones
   */
  setActive(state) {
    this.active = state
    this.targetScaleVal = state ? this.birdScale : 0.0

    if (state) {
      this.resetFlock() // 👈 REINICIA LAS POSICIONES CADA VEZ QUE SE ACTIVA
      this.flockGroup.visible = true
    }
  }

  /**
   * Bucle de simulación Boids (Separación, Alineación y Cohesión)
   */
  update(delta) {
    if (this.birds.length === 0) return

    // Interpolación LERP de entrada/salida
    if (Math.abs(this.currentScale - this.targetScaleVal) > 0.001) {
      this.currentScale += (this.targetScaleVal - this.currentScale) * 0.1
      if (this.currentScale <= 0.01 && !this.active) {
        this.flockGroup.visible = false
      }
    }

    if (!this.active && this.currentScale <= 0.01) return

    // Actualización de comportamiento de cada ave
    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i] // 👈 AQUÍ SE DEFINE COMO 'bird'

      // Actualizar aleteo de alas
      if (bird.mixer) {
        bird.mixer.update(delta)
      }

      // Aplicar reglas de Flocking
      this.applyFlockingRules(bird)

      // Integración de Euler (Física de movimiento)
      bird.velocity.add(bird.acceleration)
      bird.velocity.clampLength(0, this.maxSpeed)
      bird.position.addScaledVector(bird.velocity, delta)
      bird.acceleration.set(0, 0, 0) // Reiniciar aceleración

      // 🔒 Límite estricto de altura (Usando 'bird'):
      if (bird.position.y < this.minY) {
        bird.position.y = this.minY
        if (bird.velocity.y < 0) {
          bird.velocity.y *= -0.5 // Invierte la velocidad vertical suavemente
        }
      }

      // Actualizar escala visual del pájaro
      bird.mesh.scale.setScalar(this.currentScale)

      // Orientación: hacer que el pájaro mire hacia donde se desplaza
      if (bird.velocity.lengthSq() > 0.001) {
        const targetLook = bird.position.clone().add(bird.velocity)
        bird.mesh.lookAt(targetLook)
      }
    }
  }

  /**
   * Algoritmo Boids: Cálculo de fuerzas de Separación, Alineación y Cohesión
   */
  applyFlockingRules(boid) {
    const sep = new THREE.Vector3()
    const ali = new THREE.Vector3()
    const coh = new THREE.Vector3()

    let sepCount = 0
    let aliCount = 0
    let cohCount = 0

    for (let j = 0; j < this.birds.length; j++) {
      const other = this.birds[j]
      if (other === boid) continue

      const dist = boid.position.distanceTo(other.position)

      if (dist > 0 && dist < this.separationDist) {
        const diff = boid.position
          .clone()
          .sub(other.position)
          .normalize()
          .divideScalar(dist)
        sep.add(diff)
        sepCount++
      }

      if (dist > 0 && dist < this.alignmentDist) {
        ali.add(other.velocity)
        aliCount++
      }

      if (dist > 0 && dist < this.cohesionDist) {
        coh.add(other.position)
        cohCount++
      }
    }

    if (sepCount > 0) {
      sep
        .divideScalar(sepCount)
        .normalize()
        .multiplyScalar(this.maxSpeed)
        .sub(boid.velocity)
        .clampLength(0, this.maxForce)
    }

    if (aliCount > 0) {
      ali
        .divideScalar(aliCount)
        .normalize()
        .multiplyScalar(this.maxSpeed)
        .sub(boid.velocity)
        .clampLength(0, this.maxForce)
    }

    if (cohCount > 0) {
      coh.divideScalar(cohCount)
      const cohSteer = coh
        .sub(boid.position)
        .normalize()
        .multiplyScalar(this.maxSpeed)
        .sub(boid.velocity)
        .clampLength(0, this.maxForce)
      coh.copy(cohSteer)
    }

    // 4. ATRACCIÓN AL CENTRO (Letra L)
    const targetDir = this.center.clone().sub(boid.position)
    const distToCenter = targetDir.length()
    let centerAttraction = new THREE.Vector3()

    if (distToCenter > 4.0) {
      centerAttraction = targetDir
        .normalize()
        .multiplyScalar(this.maxSpeed)
        .sub(boid.velocity)
        .clampLength(0, this.maxForce)
    }

    // 🛡️ 5. REPULSIÓN DEL PISO (Evita que colisionen o atraviesen el suelo)
    const floorSteer = new THREE.Vector3()
    const bufferZone = 1.5 // Distancia antes del límite en la que empiezan a remontar vuelo

    if (boid.position.y < this.minY + bufferZone) {
      const pushFactor = (this.minY + bufferZone - boid.position.y) / bufferZone
      floorSteer.set(0, 1, 0).multiplyScalar(this.maxForce * pushFactor * 2.5)
    }

    // Sumatoria de fuerzas
    boid.acceleration.addScaledVector(sep, this.weightSeparation)
    boid.acceleration.addScaledVector(ali, this.weightAlignment)
    boid.acceleration.addScaledVector(coh, this.weightCohesion)
    boid.acceleration.addScaledVector(
      centerAttraction,
      this.weightCenterAttraction,
    )
    boid.acceleration.add(floorSteer) // 👈 Aplica la fuerza hacia arriba
  }
}
