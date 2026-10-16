import * as THREE from 'three'

// ----------------------------------------------------
// SHADERS GLSL: CASCADA (PATRÓN RÁFAGA)
// ----------------------------------------------------
const WaterfallShader = {
  uniforms: {
    uTexture: { value: null },
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uColorBase: { value: new THREE.Color(0xa8f5fa) },
    uColorMid: { value: new THREE.Color(0x00b4d8) },
    uColorFoam: { value: new THREE.Color(0xffffff) },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float streakVibe = sin(uv.x * 25.0 + uTime * 6.0) * 0.03;
      pos.z += streakVibe;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uColorBase;
    uniform vec3 uColorMid;
    uniform vec3 uColorFoam;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    float rafagaPattern(vec2 uv) {
      vec2 st = vec2(uv.x * 16.0, uv.y * 3.0 + uTime * 4.5);
      float n1 = noise(st);
      float n2 = noise(st * 2.0 + vec2(0.0, uTime * 2.0));
      return pow(1.0 - abs(n1 - n2), 2.5);
    }

    void main() {
      vec2 uv = vUv;
      float rafaga = rafagaPattern(uv);
      vec2 texUv = vec2(uv.x * 1.5, uv.y + uTime * 1.2 + rafaga * 0.05);
      vec4 texColor = texture2D(uTexture, texUv);

      float density = clamp(rafaga * 0.7 + texColor.r * 0.3, 0.0, 1.0);
      vec3 col = mix(uColorBase, uColorMid, density);

      float streakHighlight = smoothstep(0.45, 0.85, rafaga);
      col = mix(col, uColorFoam, streakHighlight * 0.9);

      float topFade = smoothstep(0.0, 0.12, uv.y);
      float bottomFoam = smoothstep(0.85, 1.0, 1.0 - uv.y);
      col = mix(col, uColorFoam, bottomFoam * 0.7);

      float alpha = clamp(density * 0.85 + streakHighlight * 0.4, 0.2, 0.95) * uOpacity * topFade;
      gl_FragColor = vec4(col, alpha);
    }
  `,
}

// ----------------------------------------------------
// SHADER GLSL: VAPOR / NIEBLA DE AGUA (MIST PARTICLES)
// ----------------------------------------------------
const MistParticleShader = {
  uniforms: {
    uTexture: { value: null },
    uGlobalOpacity: { value: 0 },
    uColorMist: { value: new THREE.Color(0xd4f8ff) },
  },
  vertexShader: `
    attribute float aLife;
    attribute float aSize;
    varying float vLife;

    void main() {
      vLife = aLife;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // El vapor se expande progresivamente a medida que asciende (aLife va de 0 a 1)
      float expansion = mix(0.4, 1.8, aLife);
      gl_PointSize = aSize * expansion * (300.0 / -mvPosition.z);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uGlobalOpacity;
    uniform vec3 uColorMist;
    varying float vLife;

    void main() {
      vec4 texColor = texture2D(uTexture, gl_PointCoord);
      
      // Curva de transparencia: Fade In al nacer, pico intermedio y Fade Out al disiparse
      float alphaCurve = sin(vLife * 3.1415926);
      float finalAlpha = texColor.a * alphaCurve * 0.45 * uGlobalOpacity;

      gl_FragColor = vec4(uColorMist, finalAlpha);
    }
  `,
}

export class Waterfall {
  constructor(scene, options = {}) {
    this.scene = scene
    this.spawnHeight = options.spawnHeight || 20
    this.floorY = options.floorY || -2.95
    this.width = options.width || 7.4

    this.colorBase = options.colorBase || 0xa8f5fa
    this.colorMid = options.colorMid || 0x00b4d8
    this.colorFoam = options.colorFoam || 0xffffff

    this.active = false
    this.progress = 0
    this.elapsedTime = 0

    // Configuración de Partículas de Vapor
    this.mistParticleCount = options.mistParticleCount || 300

    this.init()
  }

  // Genera dinámicamente un mapa de textura difusa y suave para el vapor
  createMistTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)')
    gradient.addColorStop(0.2, 'rgba(235, 250, 255, 0.7)')
    gradient.addColorStop(0.5, 'rgba(200, 242, 255, 0.25)')
    gradient.addColorStop(0.8, 'rgba(180, 235, 255, 0.05)')
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  init() {
    this.group = new THREE.Group()
    const height = this.spawnHeight - this.floorY

    const textureLoader = new THREE.TextureLoader()

    this.curtainTexture = textureLoader.load('/assets/water.png')
    this.curtainTexture.wrapS = THREE.RepeatWrapping
    this.curtainTexture.wrapT = THREE.RepeatWrapping

    this.poolTexture = textureLoader.load('/assets/water.png')
    this.poolTexture.wrapS = THREE.RepeatWrapping
    this.poolTexture.wrapT = THREE.RepeatWrapping
    this.poolTexture.repeat.set(2, 1)

    // Material de la cascada
    this.cascadeMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(WaterfallShader.uniforms),
      vertexShader: WaterfallShader.vertexShader,
      fragmentShader: WaterfallShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    this.cascadeMaterial.uniforms.uTexture.value = this.curtainTexture
    this.setColors(this.colorBase, this.colorMid, this.colorFoam)

    // Material del estanque
    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: this.poolTexture,
      transparent: true,
      opacity: 0,
      color: new THREE.Color(this.colorBase),
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    // 1. Cortina
    const cascadeGeo = new THREE.PlaneGeometry(this.width, height, 32, 64)
    cascadeGeo.translate(0, -height / 2, 0)
    this.cascadeMesh = new THREE.Mesh(cascadeGeo, this.cascadeMaterial)
    this.cascadeMesh.position.set(0, this.spawnHeight, 0)
    this.group.add(this.cascadeMesh)

    // 2. Estanque
    const poolGeo = new THREE.PlaneGeometry(8.5, 3.2)
    this.poolMesh = new THREE.Mesh(poolGeo, this.poolMaterial)
    this.poolMesh.rotation.x = -Math.PI / 2
    this.poolMesh.position.set(0, this.floorY + 0.02, 0)
    this.group.add(this.poolMesh)

    // 3. SISTEMA DE VAPOR DE AGUA
    this.initMistParticles()

    this.group.visible = false
    this.scene.add(this.group)
  }

  initMistParticles() {
    const count = this.mistParticleCount
    const positions = new Float32Array(count * 3)
    const lives = new Float32Array(count)
    const sizes = new Float32Array(count)

    this.mistParticleData = []

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * (this.width * 1.05)
      const y = this.floorY + Math.random() * 0.15
      const z = (Math.random() - 0.5) * 1.4

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      const life = Math.random()
      lives[i] = life
      sizes[i] = 1.2 + Math.random() * 1.4 // Tamaño base del vapor

      this.mistParticleData.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        vx: (Math.random() - 0.5) * 0.5, // Deriva lateral leve
        vy: 0.8 + Math.random() * 2, // Ascenso del vapor
        vz: (Math.random() - 0.5) * 0.5, // Deriva en profundidad
        life: life,
        maxLife: 2 + Math.random() * 1.0, // Duración del vapor
      })
    }

    this.mistGeometry = new THREE.BufferGeometry()
    this.mistGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    )
    this.mistGeometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 1))
    this.mistGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    this.mistMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(MistParticleShader.uniforms),
      vertexShader: MistParticleShader.vertexShader,
      fragmentShader: MistParticleShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending, // Mezcla suave para aspecto de nube/niebla
    })

    this.mistMaterial.uniforms.uTexture.value = this.createMistTexture()

    this.mistParticles = new THREE.Points(this.mistGeometry, this.mistMaterial)
    this.group.add(this.mistParticles)
  }

  updateMistParticles(delta) {
    if (!this.mistGeometry) return

    const positions = this.mistGeometry.attributes.position.array
    const lives = this.mistGeometry.attributes.aLife.array

    for (let i = 0; i < this.mistParticleCount; i++) {
      const p = this.mistParticleData[i]
      p.life += delta / p.maxLife

      // Reiniciar ciclo de vida del vapor al disiparse
      if (p.life >= 1.0) {
        p.life = 0
        p.baseX = (Math.random() - 0.5) * (this.width * 1.05)
        p.baseZ = (Math.random() - 0.5) * 1.4
        positions[i * 3] = p.baseX
        positions[i * 3 + 1] = this.floorY
        positions[i * 3 + 2] = p.baseZ
      }

      const t = p.life
      lives[i] = t

      // Trayectoria física del vapor: eleva y flota expansivamente
      positions[i * 3] = p.baseX + p.vx * t + Math.sin(t * 4.0 + i) * 0.1
      positions[i * 3 + 1] = this.floorY + p.vy * t
      positions[i * 3 + 2] = p.baseZ + p.vz * t
    }

    this.mistGeometry.attributes.position.needsUpdate = true
    this.mistGeometry.attributes.aLife.needsUpdate = true

    // Opacidad global del vapor según el avance de la cascada
    this.mistMaterial.uniforms.uGlobalOpacity.value = this.progress
  }

  setColors(base, mid, foam) {
    if (base) this.cascadeMaterial.uniforms.uColorBase.value.set(base)
    if (mid) this.cascadeMaterial.uniforms.uColorMid.value.set(mid)
    if (foam) this.cascadeMaterial.uniforms.uColorFoam.value.set(foam)
  }

  setActive(state) {
    this.active = state
  }

  update(delta) {
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

    const scaleY = THREE.MathUtils.lerp(0.001, 1.0, this.progress)
    this.cascadeMesh.scale.set(1, scaleY, 1)

    const opacity = this.progress * 0.9
    this.cascadeMaterial.uniforms.uOpacity.value = opacity
    this.poolMaterial.opacity = opacity * 0.75

    if (delta) {
      this.elapsedTime += delta
      this.cascadeMaterial.uniforms.uTime.value = this.elapsedTime

      this.poolTexture.offset.x += delta * 0.06
      this.poolTexture.offset.y -= delta * 0.03

      // Actualizar simulación de vapor
      this.updateMistParticles(delta)
    }
  }
}
