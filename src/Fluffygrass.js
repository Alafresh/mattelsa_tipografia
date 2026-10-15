import * as THREE from 'three'

export class FluffyGrass {
  /**
   * @param {THREE.Scene} scene - La escena de Three.js
   * @param {Object} options - Configuración del campo de pasto
   */
  constructor(scene, options = {}) {
    this.scene = scene

    // Configuración por defecto
    this.count = options.count || 25000 // Cantidad de briznas
    this.radius = options.radius || 12 // Radio del área del campo
    this.bladeWidth = options.bladeWidth || 0.15 // Ancho base de cada brizna
    this.bladeHeight = options.bladeHeight || 1.2 // Altura promedio

    // Colores característicos de la marca
    this.colorBase = options.colorBase || new THREE.Color(0x0d280c) // Verde sombra raíz
    this.colorTip = options.colorTip || new THREE.Color(0xa2cc38) // Verde ácido Mattelsa (puntas)

    // Variables de control de densidad y animación
    this.currentScale = 0
    this.targetScale = 0

    this.init()
  }

  init() {
    // 1. Geometría de una brizna con curvas y segmentos verticales para deformación por viento
    const geometry = new THREE.PlaneGeometry(
      this.bladeWidth,
      this.bladeHeight,
      1,
      4,
    )
    geometry.translate(0, this.bladeHeight / 2, 0) // Mover el pivote a la base

    // Ajustar vértices para darle forma ahusada/puntiaguda a la brizna
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const heightPercent = y / this.bladeHeight
      const widthFactor = 1.0 - Math.pow(heightPercent, 2)
      pos.setX(i, pos.getX(i) * widthFactor)
    }
    geometry.computeVertexNormals()

    // 2. Custom Shaders para viento y gradiente de color
    const grassMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vHeight;

        float simpleNoise(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          vUv = uv;
          vHeight = position.y;

          vec4 worldInstancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          
          float windSample = sin(uTime * 2.0 + worldInstancePos.x * 0.8 + worldInstancePos.z * 0.8);
          float gust = sin(uTime * 0.5 + worldInstancePos.x * 0.2) * 0.5 + 0.5;
          
          float bendFactor = pow(uv.y, 1.5) * (windSample * 0.4 + gust * 0.3);

          vec3 transformed = position;
          transformed.x += bendFactor * 0.3;
          transformed.z += bendFactor * 0.2;

          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorBase;
        uniform vec3 uColorTip;
        varying vec2 vUv;
        varying float vHeight;

        void main() {
          vec3 finalColor = mix(uColorBase, uColorTip, pow(vUv.y, 1.2));
          float ao = smoothstep(0.0, 0.3, vUv.y);
          finalColor *= (0.4 + 0.6 * ao);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uColorBase: { value: this.colorBase },
        uColorTip: { value: this.colorTip },
      },
      side: THREE.DoubleSide,
    })

    this.material = grassMaterial

    // 3. Crear InstancedMesh
    this.mesh = new THREE.InstancedMesh(geometry, grassMaterial, this.count)
    this.mesh.receiveShadow = true

    // Estado inicial: oculto y con escala 0 en Y
    this.mesh.visible = false
    this.mesh.scale.set(1, 0, 1)

    const dummy = new THREE.Object3D()
    for (let i = 0; i < this.count; i++) {
      const r = Math.sqrt(Math.random()) * this.radius
      const theta = Math.random() * Math.PI * 2

      const x = r * Math.cos(theta)
      const z = r * Math.sin(theta)
      const y = -3.0 // Altura alineada con el piso de la escena

      if (Math.abs(x) < 4 && Math.abs(z) < 1.5) {
        dummy.scale.set(0, 0, 0)
      } else {
        dummy.position.set(x, y, z)
        dummy.rotation.y = Math.random() * Math.PI * 2
        dummy.rotation.x = (Math.random() - 0.5) * 0.2
        dummy.rotation.z = (Math.random() - 0.5) * 0.2

        const scaleY = 0.7 + Math.random() * 0.6
        const scaleXZ = 0.8 + Math.random() * 0.4
        dummy.scale.set(scaleXZ, scaleY, scaleXZ)
      }

      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }

    this.mesh.instanceMatrix.needsUpdate = true
    this.scene.add(this.mesh)
  }

  /**
   * Actualiza la animación del viento y la transición suave de visibilidad
   */
  update(elapsedTime) {
    if (this.material) {
      this.material.uniforms.uTime.value = elapsedTime
    }

    // Transición interpolada de la escala en Y
    if (Math.abs(this.currentScale - this.targetScale) > 0.001) {
      this.currentScale += (this.targetScale - this.currentScale) * 0.08
      this.mesh.scale.set(1, this.currentScale, 1)

      // Cuando la escala llega casi a cero, desactivar la malla por completo
      if (this.currentScale <= 0.01) {
        this.currentScale = 0
        this.mesh.scale.set(1, 0, 1)
        this.mesh.visible = false
      } else {
        this.mesh.visible = true
      }
    }
  }

  /**
   * Define el objetivo de densidad (1.0 = activado/crecido, 0.0 = desactivado/oculto)
   */
  setDensity(scaleFactor) {
    this.targetScale = scaleFactor
    if (scaleFactor > 0) {
      this.mesh.visible = true
    }
  }
}
