import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FluffyGrass } from './Fluffygrass.js'
import { Waterfall } from './Waterfall.js'
import { Trees } from './Trees.js'
import { Rabbit } from './Rabbit.js'
import { Bird } from './Bird.js'
import { BirdFlock } from './BirdFlock.js'
import { Fireflies } from './Fireflies.js'

// --- CONFIGURACIÓN PRINCIPAL DE THREE.JS ---
const container = document.getElementById('webgl-container')
const scene = new THREE.Scene()
// --- CARGA DE SKYBOX (CUBEMAP) ---
const cubeTextureLoader = new THREE.CubeTextureLoader()
const skyboxTexture = cubeTextureLoader.load([
  '/assets/px.png', // +X
  '/assets/nx.png', // -X
  '/assets/py.png', // +Y (Cielo)
  '/assets/ny.png', // -Y (Suelo)
  '/assets/pz.png', // +Z
  '/assets/nz.png', // -Z
])
// 💡 1. DECLARACIÓN DE FONDO Y NIEBLA POR DEFECTO
const defaultBackground = new THREE.Color(0x0a0a0a)
const defaultFog = new THREE.FogExp2(0x0a0a0a, 0.025)

scene.background = defaultBackground
scene.fog = defaultFog

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.5,
  100,
)
camera.position.set(0, 2, 18)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
container.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.maxPolarAngle = Math.PI / 2 + 0.05

const axesHelper = new THREE.AxesHelper()
scene.add(axesHelper)

// --- ILUMINACIÓN (SOPORTE PARA SOMBRAS Y AMBIENTE) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
dirLight.position.set(10, 15, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 2048
dirLight.shadow.mapSize.height = 2048
scene.add(dirLight)

// --- 1. CARGA DE TEXTURAS Y MATERIALES MATCAP ---
const textureLoader = new THREE.TextureLoader()

const matcapBrutalistTexture = textureLoader.load('/assets/2.png')
const matcapFriendlyTexture = textureLoader.load('/assets/5.png')

const brutalistMaterial = new THREE.MeshMatcapMaterial({
  matcap: matcapBrutalistTexture,
})

const friendlyMaterial = new THREE.MeshMatcapMaterial({
  matcap: matcapFriendlyTexture,
})

// --- CARGA DE TEXTURAS DE SUELO (PRADERA) ---
const grassAlbedo = textureLoader.load('/assets/Grass_2_Albedo.png')
const grassNormal = textureLoader.load('/assets/Grass_2_Normal.png')

// Repetición en patrón para cubrir los 100x100 del plano de suelo
const repeatFactor = 15
;[grassAlbedo, grassNormal].forEach((tex) => {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatFactor, repeatFactor)
})

// --- INSTANCIACIÓN DE HIERBA (FLUFFY GRASS - INICIA OCULTO) ---
const grassField = new FluffyGrass(scene, {
  count: 32000,
  radius: 15,
  colorTip: new THREE.Color(0xa2cc38),
})
grassField.setDensity(0)

// 🌊 Instancia de la Cascada
const waterfall = new Waterfall(scene, {
  colorBase: 0x3399ff, // Azul turquesa cristalino
  colorMid: 0x0077b6, // Azul medio del Physarum
  colorFoam: 0xbef8fe, // Blanco
})

const tree1 = new Trees(scene, {
  modelPath: '/assets/tree_toon_1.glb',
  position: new THREE.Vector3(-8, -2.95, -8), // Ubicado junto a la 1ra T
  scale: 1,
})

// Árbol 2: Asociado a la segunda 'T' (índice 3)
const tree2 = new Trees(scene, {
  modelPath: '/assets/tree_toon_2.glb',
  position: new THREE.Vector3(8, -2.95, -9), // Ubicado junto a la 2da T
  scale: 1,
})

// --- INSTANCIACIÓN DEL CONEJO ---
const rabbit = new Rabbit(scene, {
  modelPath: '/assets/conejo.glb',
  texturePath: '/assets/9.png',
  radiusX: 8.5, // Radio amplio horizontal
  radiusZ: 4.5, // Radio amplio en profundidad
  floorY: -2.95,
  scale: 0.8,
})

// --- INSTANCIACIÓN DEL PÁJARO ---
const bird = new Bird(scene, {
  modelPath: '/assets/Pajaro.glb',
  animationName: 'Fly',
  position: new THREE.Vector3(1.8, 0.8, 0.0), // Ajusta la altura sobre la letra L
  scale: 0.6,
  radiusX: 1.8,
  radiusZ: 1.2,
  flySpeed: 1.8,
})

const birdFlock = new BirdFlock(scene, {
  modelPath: '/assets/Pajaro.glb',
  animationName: 'Fly',
  count: 24,
  center: new THREE.Vector3(1.8, 1.2, 0.0),
  scale: 0.5,
  minY: -0.2, // 👈 Ajusta esta altura mínima para mantener a las aves volando bien arriba del pasto
  spawnRadius: 5.0,
  maxSpeed: 3.5,
})
// --- INSTANCIACIÓN DE LUCIÉRNAGAS ---
const fireflies = new Fireflies(scene, {
  count: 45,
  position: new THREE.Vector3(0, -0.5, 0.0), // Ajusta la coordenada según la ubicación de tu S
  radius: 10,
})

// --- CARGA DE FUENTES Y MESHES DE MATTELSA ---
const letterGroup = new THREE.Group()
scene.add(letterGroup)

const lettersData = ['M', 'A', 'T', 'T', 'E', 'L', 'S', 'A']
const letterMeshes = []
const fontLoader = new FontLoader()

const letterSpacing = 1.4
const totalWidth = lettersData.length * letterSpacing

fontLoader.load('./assets/Montserrat_Regular.json', (fontBrutalist) => {
  fontLoader.load('./assets/Sour_Gummy_Regular.json', (fontFriendly) => {
    lettersData.forEach((char, index) => {
      // Geometría Brutalista (Montserrat)
      const brutalistGeo = new TextGeometry(char, {
        font: fontBrutalist,
        size: 1.3,
        height: 0.35,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelSegments: 3,
      })
      brutalistGeo.scale(1, 1, 0.005)
      brutalistGeo.center()

      // Geometría Amigable (Sour Gummy)
      const friendlyGeo = new TextGeometry(char, {
        font: fontFriendly,
        size: 1.3,
        height: 0.45,
        bevelEnabled: true,
        bevelThickness: 0.07,
        bevelSize: 0.05,
        bevelSegments: 5,
      })
      friendlyGeo.scale(1, 1, 0.01)
      friendlyGeo.center()

      // Mesh Inicial
      const mesh = new THREE.Mesh(brutalistGeo, brutalistMaterial)
      const targetX = index * letterSpacing - totalWidth / 2 + letterSpacing / 2
      mesh.position.set(targetX, 0, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true

      mesh.userData = {
        id: char,
        index: index,
        homePos: new THREE.Vector3(targetX, 0, 0),
        targetPos: new THREE.Vector3(targetX, 0, 0),
        targetRot: new THREE.Euler(0, 0, 0),
        isFriendly: false,
        brutalistGeo: brutalistGeo,
        friendlyGeo: friendlyGeo,
        scaleAnim: 1.0,
      }

      letterMeshes.push(mesh)
      letterGroup.add(mesh)
    })
  })
})

// --- INTERACCIÓN POR CLIC (RAYCASTING) ---
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('pointerdown', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(letterMeshes)

  if (intersects.length > 0) {
    const selectedMesh = intersects[0].object
    selectedMesh.userData.isFriendly = !selectedMesh.userData.isFriendly

    if (selectedMesh.userData.isFriendly) {
      selectedMesh.geometry = selectedMesh.userData.friendlyGeo
      selectedMesh.material = friendlyMaterial
      selectedMesh.userData.targetRot.y += Math.PI * 2
      selectedMesh.userData.scaleAnim = 1.35
      updateStatus(
        `Letra ${selectedMesh.userData.id} Transformada`,
        'Estado consciente activado.',
      )
    } else {
      selectedMesh.geometry = selectedMesh.userData.brutalistGeo
      selectedMesh.material = brutalistMaterial
      selectedMesh.userData.scaleAnim = 1.35
      updateStatus('Modo Streetwear', 'Regreso a la coraza industrial.')
    }

    // 🌿 LÓGICA DE ACTIVACIÓN DE PASTO CON LA LETRA 'M'
    if (selectedMesh.userData.id === 'M') {
      if (selectedMesh.userData.isFriendly) {
        grassField.setDensity(1.0)
      } else {
        grassField.setDensity(0.0)
      }
    }
    // 🌊 PRIMERA 'A' (índice 1): Activa/Desactiva Cascada
    if (selectedMesh.userData.index === 1) {
      waterfall.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly
          ? 'Cascada Activada'
          : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🌊 El agua fluye sobre las letras del ecosistema.'
          : 'Estado industrial restaurado.',
      )
    }
    // 🌳 3. PRIMERA 'T' (índice 2): Brota el primer tipo de árbol
    if (selectedMesh.userData.index === 2) {
      tree1.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly ? 'Reserva Magara' : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🌳 Nace la primera especie de árbol del Bosque Seco Tropical.'
          : 'Estado industrial restaurado.',
      )
    }

    // 🌲 4. SEGUNDA 'T' (índice 3): Brota el segundo tipo de árbol
    if (selectedMesh.userData.index === 3) {
      tree2.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly ? 'Reserva Makuk' : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🌲 Nace la segunda especie de árbol de la reserva.'
          : 'Estado industrial restaurado.',
      )
    }
    // 🐇 5. LETRA 'E' (índice 4): Activa/Desactiva el Conejo
    if (selectedMesh.userData.index === 4) {
      rabbit.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly ? 'Fauna Activada' : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🐇 El conejo orbita saltando alrededor de la marca.'
          : 'Estado industrial restaurado.',
      )
    }
    // 🕊️ LETRA 'L' (índice 5): Activa/Desactiva la Bandada en Flocking
    if (selectedMesh.userData.index === 5) {
      birdFlock.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly
          ? 'Ecosistema de Aves Activado'
          : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🕊️ Bandada volando con algoritmo Flocking (Separación, Alineación y Cohesión).'
          : 'Estado industrial restaurado.',
      )
    }
    // ✨ 7. LETRA 'S' (índice 6): Activa/Desactiva las Luciérnagas
    if (selectedMesh.userData.index === 6) {
      fireflies.setActive(selectedMesh.userData.isFriendly)
      updateStatus(
        selectedMesh.userData.isFriendly
          ? 'Luz Orgánica Activada'
          : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '✨ Enjambre de luciérnagas flotando sobre la letra S.'
          : 'Estado industrial restaurado.',
      )
    }
    // 🌌 8. ÚLTIMA 'A' (índice 7): Activa/Desactiva el Skybox y el Suelo de Pradera
    if (selectedMesh.userData.index === 7) {
      if (selectedMesh.userData.isFriendly) {
        scene.background = skyboxTexture
        scene.fog = null
      } else {
        scene.background = defaultBackground
        scene.fog = defaultFog
      }

      updateStatus(
        selectedMesh.userData.isFriendly
          ? 'Ecosistema Completo Activado'
          : 'Modo Streetwear',
        selectedMesh.userData.isFriendly
          ? '🌌 Cielorrama vivo y pradera detallada integrados en la escena.'
          : 'Estado industrial restaurado.',
      )
    }
  }
})

// --- BOTÓN DE RESET ---
function updateStatus(title, text) {
  const modeElem = document.getElementById('status-mode')
  const msgElem = document.getElementById('status-msg')
  if (modeElem) modeElem.innerText = title
  if (msgElem) msgElem.innerText = text
}

// --- BUCLE DE ANIMACIÓN Y RENDER ---
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const time = clock.getElapsedTime()
  grassField.update(time)
  waterfall.update(delta)
  tree1.update()
  tree2.update()
  rabbit.update(delta)
  bird.update(delta)
  birdFlock.update(delta)
  fireflies.update(time)
  controls.update()

  letterMeshes.forEach((mesh) => {
    mesh.position.lerp(mesh.userData.targetPos, 0.08)
    mesh.rotation.x += (mesh.userData.targetRot.x - mesh.rotation.x) * 0.08
    mesh.rotation.y += (mesh.userData.targetRot.y - mesh.rotation.y) * 0.08
    mesh.rotation.z += (mesh.userData.targetRot.z - mesh.rotation.z) * 0.08

    // Animación de impacto en escala
    if (mesh.userData.scaleAnim > 1.0) {
      mesh.userData.scaleAnim = THREE.MathUtils.lerp(
        mesh.userData.scaleAnim,
        1.0,
        0.1,
      )
      mesh.scale.setScalar(mesh.userData.scaleAnim)
    }

    // Flotación suave en estado amigable
    if (mesh.userData.isFriendly) {
      mesh.position.y =
        mesh.userData.targetPos.y +
        Math.sin(time * 3 + mesh.userData.index) * 0.12
    }
  })

  renderer.render(scene, camera)
}

animate()

// --- RESPONSIVE RESIZE ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
