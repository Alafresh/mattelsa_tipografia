import * as THREE from 'three'

// ----------------------------------------------------
// SHADERS GLSL: PATRÓN 7 ("RÁFAGA") CON FLUJO HACIA ABAJO
// ----------------------------------------------------
const WaterfallShader = {
  uniforms: {
    uTexture: { value: null },
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    // 🎨 VARIABLES DE COLOR EDITABLES
    uColorBase: { value: new THREE.Color(0xa8f5fa) }, // Agua clara cristalina
    uColorMid: { value: new THREE.Color(0x00b4d8) }, // Azul Ráfaga (Cian/Azul)
    uColorFoam: { value: new THREE.Color(0xffffff) }, // Espuma / Destello blanco
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Vibración sutil estilo Ráfaga rápida
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
    
    // Unifoms de Color
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

    // --- RECREACIÓN DEL PATRÓN 7: RÁFAGA (Estirado en Y, estrecho en X) ---
    float rafagaPattern(vec2 uv) {
      // sd=20 (estirado vertical), sa=0.15 (estrecho), md=2.0 (velocidad rápida)
      vec2 st = vec2(uv.x * 16.0, uv.y * 3.0 + uTime * 4.5); 
      
      float n1 = noise(st);
      float n2 = noise(st * 2.0 + vec2(0.0, uTime * 2.0));
      
      // Crestas afiladas y rectas
      float rafaga = 1.0 - abs(n1 - n2);
      return pow(rafaga, 2.5); // Afila las líneas para simular hilos rectos de agua
    }

    void main() {
      vec2 uv = vUv;
      
      // Patrón Ráfaga fluyendo estrictamente HACIA ABAJO
      float rafaga = rafagaPattern(uv);
      
      // Textura base desplazándose hacia abajo
      vec2 texUv = vec2(uv.x * 1.5, uv.y + uTime * 1.2 + rafaga * 0.05);
      vec4 texColor = texture2D(uTexture, texUv);

      // Mezcla de intensidad
      float density = clamp(rafaga * 0.7 + texColor.r * 0.3, 0.0, 1.0);

      // ----------------------------------------------------
      // MEZCLA DINÁMICA CON LOS COLORES CONFIGURABLES
      // ----------------------------------------------------
      vec3 col = mix(uColorBase, uColorMid, density);

      // Destellos blancos afilados de la Ráfaga
      float streakHighlight = smoothstep(0.45, 0.85, rafaga);
      col = mix(col, uColorFoam, streakHighlight * 0.9);

      // Desvanecimiento superior e impacto en la base
      float topFade = smoothstep(0.0, 0.12, uv.y);
      float bottomFoam = smoothstep(0.85, 1.0, 1.0 - uv.y);
      col = mix(col, uColorFoam, bottomFoam * 0.7);

      float alpha = clamp(density * 0.85 + streakHighlight * 0.4, 0.2, 0.95) * uOpacity * topFade;

      gl_FragColor = vec4(col, alpha);
    }
  `,
}

export class Waterfall {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} options
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.spawnHeight = options.spawnHeight || 8.5
    this.floorY = options.floorY || -2.95
    this.width = options.width || 7.4

    // 🎨 Colores iniciales personalizables (Hexadecimal o THREE.Color)
    this.colorBase = options.colorBase || 0xa8f5fa // Agua clara
    this.colorMid = options.colorMid || 0x00b4d8 // Azul Ráfaga
    this.colorFoam = options.colorFoam || 0xffffff // Espuma / Blanco

    this.active = false
    this.progress = 0
    this.elapsedTime = 0

    this.init()
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

    // Crear el Shader Material asignando los colores de las variables
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

    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: this.poolTexture,
      transparent: true,
      opacity: 0,
      color: new THREE.Color(this.colorBase),
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const cascadeGeo = new THREE.PlaneGeometry(this.width, height, 32, 64)
    cascadeGeo.translate(0, -height / 2, 0)

    this.cascadeMesh = new THREE.Mesh(cascadeGeo, this.cascadeMaterial)
    this.cascadeMesh.position.set(0, this.spawnHeight, 0)
    this.group.add(this.cascadeMesh)

    const poolGeo = new THREE.PlaneGeometry(8.5, 3.2)
    this.poolMesh = new THREE.Mesh(poolGeo, this.poolMaterial)
    this.poolMesh.rotation.x = -Math.PI / 2
    this.poolMesh.position.set(0, this.floorY + 0.02, 0)
    this.group.add(this.poolMesh)

    this.group.visible = false
    this.scene.add(this.group)
  }

  /**
   * Método público para cambiar los colores en tiempo real
   */
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
    }
  }
}
