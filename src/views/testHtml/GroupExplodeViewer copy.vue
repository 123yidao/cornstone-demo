// GroupExplodeViewer.vue
<template>
  <div ref="container" class="viewer"></div>
  <button class="btn" @click="toggleExplode">
    {{ exploded ? '组合模型' : '拆分模型' }}
  </button>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { CSS2DRenderer, CSS2DObject }
  from 'three/examples/jsm/renderers/CSS2DRenderer'

const container = ref(null)
const exploded = ref(false)

let scene, camera, renderer, controls
let group
let raycaster = new THREE.Raycaster()
let mouse = new THREE.Vector2()
let labelRenderer
// 记录每个模型的原始位置
const parts = []

function initThree () {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbbbbbbb)

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 0, 200)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth,
    container.value.clientHeight)
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const light = new THREE.DirectionalLight(0xffffff, 0.8)
  light.position.set(100, 100, 100)
  scene.add(light)
}

function loadModels () {
  group = new THREE.Group()
  scene.add(group)

  const loader = new OBJLoader()
  const urls = ['/model/naoshi.obj', '/model/zhongniu.obj', '/model/dongmai.obj']

  urls.forEach((url, index) => {
    loader.load(url, (obj) => {
      obj.traverse((c) => {
        if (c.isMesh) {
          c.material = new THREE.MeshStandardMaterial({ color: 0xcccccc })
        }
      })

      // 初始组合状态的位置（可根据需要微调）
      obj.position.set(0, 0, 0)
      group.add(obj)
      addLabel(obj, `部件 ${index + 1}`)
      console.log(obj, 'obj---');
      parts.push({
        object: obj,
        origin: obj.position.clone(),
        direction: new THREE.Vector3(
          Math.cos((index / urls.length) * Math.PI * 2),
          0,
          Math.sin((index / urls.length) * Math.PI * 2)
        ),
      })

    })
  })
}

function toggleExplode () {
  exploded.value = !exploded.value
  const distance = 60

  parts.forEach((p) => {
    if (exploded.value) {
      p.object.position
        .copy(p.origin)
        .add(p.direction.clone().multiplyScalar(distance))
    } else {
      p.object.position.copy(p.origin)
    }
  })
}

function onClick (event) {
  if (!exploded.value) return

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(group.children, true)

  if (intersects.length > 0) {
    const mesh = intersects[0].object

    group.children.forEach((obj) => {
      obj.traverse((c) => {
        if (c.isMesh) {
          c.material.color.set(0x555555)
        }
      })
    })

    mesh.material.color.set(0xff5555)
    controls.target.copy(mesh.getWorldPosition(new THREE.Vector3()))
    controls.update()
  }
}

function animate () {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
function addLabel (object, text) {
  const div = document.createElement('div')
  div.className = 'label'
  div.innerText = text

  const label = new CSS2DObject(div)
  label.position.set(0, 20, 0) // 角标相对模型的位置

  object.add(label)
}
function initLabelRenderer () {
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'

  container.value.appendChild(labelRenderer.domElement)
}
onMounted(() => {
  initThree()

  loadModels()
  initLabelRenderer()
  animate()

  window.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onClick)
  renderer.dispose()
})
</script>

<style scoped>
.viewer {
  width: 512px;
  height: 512px;
}

canvas {
  width: 512px;
  height: 512px;
}

.btn {
  /* position: absolute; */
  top: 20px;
  left: 20px;
  padding: 8px 12px;
}

.label {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: auto;
}
</style>
