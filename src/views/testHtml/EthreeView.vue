// ExplodeView.vue
<template>
  <div ref="container" class="viewer"></div>
  <input class="slider" type="range" min="0" max="1" step="0.01" v-model="factor" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const container = ref(null)
const factor = ref(0)

let scene, camera, renderer, controls
let model
let parts = []

function initThree () {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111111)

  camera = new THREE.PerspectiveCamera(
    60,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(0, 80, 160)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(
    container.value.clientWidth,
    container.value.clientHeight
  )
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const light1 = new THREE.DirectionalLight(0xffffff, 1)
  light1.position.set(100, 100, 100)
  scene.add(light1)
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
}

function loadModel () {
  const loader = new GLTFLoader()
  loader.load('/model/pelvis_ge.obj', (gltf) => {
    model = gltf.scene
    scene.add(model)

    prepareExplode(model)
  })
}

function prepareExplode (root) {
  const modelCenter = new THREE.Box3()
    .setFromObject(root)
    .getCenter(new THREE.Vector3())

  root.traverse((child) => {
    if (child.isMesh) {
      const origin = child.position.clone()

      const partCenter = new THREE.Box3()
        .setFromObject(child)
        .getCenter(new THREE.Vector3())

      const direction = new THREE.Vector3()
        .subVectors(partCenter, modelCenter)
        .normalize()

      parts.push({
        mesh: child,
        origin,
        direction,
      })
    }
  })
}

function setExplode (t) {
  const distance = 40
  parts.forEach((p) => {
    p.mesh.position
      .copy(p.origin)
      .add(p.direction.clone().multiplyScalar(distance * t))
  })
}

function animate () {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  initThree()
  loadModel()
  animate()
})

onBeforeUnmount(() => {
  renderer.dispose()
})

watch(factor, (v) => setExplode(Number(v)))
</script>

<style scoped>
.viewer {
  width: 100vw;
  height: 100vh;
}

.slider {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
}
</style>
