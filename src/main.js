import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FluffyGrass } from './Fluffygrass.js'

// --- CONFIGURACIÓN PRINCIPAL DE THREE.JS ---
const container = document.getElementById('webgl-container')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a0a)
scene.fog = new THREE.FogExp2(0x0a0a0a, 0.025)

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(10, 15, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 2048
dirLight.shadow.mapSize.height = 2048
scene.add(dirLight)

// --- 1. CARGA DE TEXTURAS Y MATERIALES MATCAP ---
const textureLoader = new THREE.TextureLoader()

const matcapBrutalistTexture = textureLoader.load('/assets/1.png')
const matcapFriendlyTexture = textureLoader.load('/assets/5.png')

const brutalistMaterial = new THREE.MeshMatcapMaterial({
  matcap: matcapBrutalistTexture,
})

const friendlyMaterial = new THREE.MeshMatcapMaterial({
  matcap: matcapFriendlyTexture,
})

// --- PISO DE LA ESCENA ---
const floorGeo = new THREE.PlaneGeometry(100, 100)
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.85,
  metalness: 0.1,
})
const floor = new THREE.Mesh(floorGeo, floorMat)
floor.rotation.x = -Math.PI / 2
floor.position.y = -3
floor.receiveShadow = true
scene.add(floor)

// --- INSTANCIACIÓN DE HIERBA (FLUFFY GRASS - INICIA OCULTO) ---
const grassField = new FluffyGrass(scene, {
  count: 32000,
  radius: 15,
  colorTip: new THREE.Color(0xa2cc38),
})
grassField.setDensity(0)

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
  }
})

// --- BOTÓN DE RESET ---
function updateStatus(title, text) {
  const modeElem = document.getElementById('status-mode')
  const msgElem = document.getElementById('status-msg')
  if (modeElem) modeElem.innerText = title
  if (msgElem) msgElem.innerText = text
}

const btnReset = document.getElementById('btn-reset')
btnReset?.addEventListener('click', () => {
  letterMeshes.forEach((mesh) => {
    mesh.userData.isFriendly = false
    mesh.geometry = mesh.userData.brutalistGeo
    mesh.material = brutalistMaterial
    mesh.userData.targetPos.copy(mesh.userData.homePos)
    mesh.userData.targetRot.set(0, 0, 0)
  })
  grassField.setDensity(0.0)
  updateStatus('Sistema Reiniciado', 'Modo Streetwear Brutalista Activo.')
})

// --- BUCLE DE ANIMACIÓN Y RENDER ---
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const time = clock.getElapsedTime()

  grassField.update(time)
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
