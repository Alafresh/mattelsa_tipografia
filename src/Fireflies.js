import * as THREE from 'three'

export class Fireflies {
  /**
   * @param {THREE.Scene} scene - Escena de Three.js
   * @param {Object} options - Opciones de configuración
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.count = options.count || 40 // Cantidad de luciérnagas
    this.position = options.position || new THREE.Vector3(0, 0, 0) // Posición de la letra S
    this.radius = options.radius || 2.2 // Radio de dispersión en torno a la S

    this.active = false
    this.currentScale = 0
    this.targetScaleVal = 0

    this.particlesGroup = null
    this.particleGeometry = null
    this.particleMaterial = null
    this.firefliesData = []

    this.init()
  }

  init() {
    this.particlesGroup = new THREE.Group()
    this.particlesGroup.position.copy(this.position)

    // Crear una textura circular brillante en código
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 200, 1)')
    gradient.addColorStop(0.3, 'rgba(200, 240, 100, 0.8)')
    gradient.addColorStop(0.7, 'rgba(100, 220, 120, 0.2)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)

    const glowTexture = new THREE.CanvasTexture(canvas)

    // Geometría y atributos de las partículas
    this.particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(this.count * 3)

    for (let i = 0; i < this.count; i++) {
      const x = (Math.random() - 0.5) * this.radius * 2
      const y = (Math.random() - 0.2) * 3.0 // Distribución a lo largo de la altura de la S
      const z = (Math.random() - 0.5) * this.radius * 2

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Guardar parámetros de movimiento individual
      this.firefliesData.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        speedX: 0.5 + Math.random() * 0.8,
        speedY: 0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 1.5 + Math.random() * 2.0,
      })
    }

    this.particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    )

    // Material de puntos luminosos con adición de color
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.35,
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Evita conflictos de z-buffer con la letra
      opacity: 0,
    })

    const particles = new THREE.Points(
      this.particleGeometry,
      this.particleMaterial,
    )
    this.particlesGroup.add(particles)
    this.particlesGroup.visible = false

    this.scene.add(this.particlesGroup)
  }

  /**
   * Activa/Desactiva las luciérnagas con LERP
   */
  setActive(state) {
    this.active = state
    this.targetScaleVal = state ? 1.0 : 0.0
    if (state) {
      this.particlesGroup.visible = true
    }
  }

  /**
   * Bucle de animación: Flotación orgánica y parpadeo de luz
   */
  update(time) {
    if (!this.particlesGroup) return

    // Interpolación LERP de opacidad y escala
    if (Math.abs(this.currentScale - this.targetScaleVal) > 0.001) {
      this.currentScale += (this.targetScaleVal - this.currentScale) * 0.08
      this.particleMaterial.opacity = this.currentScale

      if (this.currentScale <= 0.01 && !this.active) {
        this.particlesGroup.visible = false
      }
    }

    if (!this.active && this.currentScale <= 0.01) return

    const positions = this.particleGeometry.attributes.position.array

    for (let i = 0; i < this.count; i++) {
      const data = this.firefliesData[i]

      // Movimiento ondulante senoidal
      positions[i * 3] =
        data.baseX + Math.sin(time * data.speedX + data.phase) * 0.4
      positions[i * 3 + 1] =
        data.baseY + Math.sin(time * data.speedY + data.phase) * 0.5
      positions[i * 3 + 2] =
        data.baseZ + Math.cos(time * data.speedX * 0.7 + data.phase) * 0.4
    }

    this.particleGeometry.attributes.position.needsUpdate = true
  }
}
