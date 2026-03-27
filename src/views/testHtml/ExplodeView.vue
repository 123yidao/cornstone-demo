<!-- ObjViewer.vue -->
<template>
  <div ref="container" class="viewer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'

const container = ref(null)

let scene, camera, renderer, controls

function initThree () {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xaaaaaa)

  camera = new THREE.PerspectiveCamera(
    60,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    1000
  )

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(
    container.value.clientWidth,
    container.value.clientHeight
  )
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  // 灯光（必须）
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(100, 100, 100)
  scene.add(dirLight)
}

function loadOBJ () {
  const loader = new OBJLoader()
  loader.load('/model/vein.obj', (obj) => {
    // 给所有 mesh 设置统一材质
    obj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x867e6b,
          metalness: 0.2,
          roughness: 0.6,
        })
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // 自动居中 & 缩放
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    obj.position.sub(center)

    const maxAxis = Math.max(size.x, size.y, size.z)
    const scale = 80 / maxAxis
    obj.scale.setScalar(scale)

    scene.add(obj)

    camera.position.set(0, 0, 150)
    controls.target.set(0, 0, 0)
    controls.update()
  })
}

function animate () {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  initThree()
  loadOBJ()
  animate()
})

onBeforeUnmount(() => {
  renderer.dispose()
})
</script>

<style scoped>
.viewer {
  width: 512px;
  height: 512px;
}
</style>
