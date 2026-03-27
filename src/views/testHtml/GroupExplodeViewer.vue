<template>
  <div class="wrapper">
    <div ref="container" class="viewer">
      <div class="control-btn" v-if="viewMode !== 'single'">
        <button class="btn" @click="toggleExplode">
          {{ exploded ? '复原' : '拆解图' }}
        </button>
        <button class="btn" @click="dialogVisible = true">
          查看CT
        </button>
      </div>
      <button class="back" v-else @click="exitSingleView">
        返回
      </button>
      <div class="part-bar" v-if="viewMode === 'single'">
        <div v-for="part in PARTS_CONFIG" :key="part.key" class="part-btn"
          :class="{ active: part.key === activePartName }" @click="switchPart(part)">
          <img :src="part.icon" class="icon" />
          <span class="text">{{ part.label }}</span>
        </div>
      </div>
    </div>
    <el-dialog v-model="dialogVisible" title="CT图查看" width="550" :before-close="handleClose" :show-footer="false">
      <div>
        <DicView />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import DicView from './loadniitoDciom.vue'

/* ---------------- 基础状态 ---------------- */
const dialogVisible = ref(false)
const container = ref(null)
const exploded = ref(false)
const viewMode = ref('overview') // 'overview' | 'single'
const activePartName = ref(null) // 当前显示的部位 name
const PARTS_CONFIG = [
  {
    key: 'Pelvis',
    label: '盆骨',
    icon: '/images/pelvis.png',
  },
  {
    key: 'Uterine_tube',
    label: '输卵管',
    icon: '/images/uterine_tube.png',
  },
  {
    key: 'Ovaries',
    label: '卵巢',
    icon: '/images/ovaries.png',
  },
  {
    key: 'Uterus',
    label: '子宫',
    icon: '/images/uterus.png',
  },
  {
    key: 'Vagina',
    label: '阴道',
    icon: '/images/vagina.png',
  },
  {
    key: 'Bladder',
    label: '膀胱',
    icon: '/images/bladder.png',
  },
  {
    key: 'Urethra',
    label: '尿道',
    icon: '/images/urethra.png',
  },
  {
    key: 'Rectum',
    label: '直肠',
    icon: '/images/rectum.png',
  },
]

let scene, camera, renderer, controls
let labelRenderer
let group

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let selectedMesh = null

// 缓存 mesh 原始颜色
const originalColors = new WeakMap()
// 每个部件的状态记录
const parts = []
let isDragging = false
let downPos = { x: 0, y: 0 }

/* ---------------- 初始化 Three ---------------- */
function initThree () {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfbfbf)

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
  camera.position.set(0, 0, 220)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(1440, 800)
  renderer.physicallyCorrectLights = true
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.value.appendChild(renderer.domElement)
  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = false
    downPos.x = e.clientX
    downPos.y = e.clientY
  })

  renderer.domElement.addEventListener('mousemove', e => {
    const dx = e.clientX - downPos.x
    const dy = e.clientY - downPos.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      isDragging = true
    }
  })
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  setupLights(scene)
}
function setupLights (scene) {
  // 1️⃣ 环境光：整体不死黑
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambient)

  // 2️⃣ 主光（左前上）
  const keyLight = new THREE.DirectionalLight(0xffffff, 1)
  keyLight.position.set(120, 120, 100)
  scene.add(keyLight)

  // 3️⃣ 辅光（右前下）
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
  fillLight.position.set(-100, 40, 80)
  scene.add(fillLight)

  // 4️⃣ 轮廓光（背后）
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8)
  rimLight.position.set(0, 100, -150)
  scene.add(rimLight)
}
/* ---------------- 标签渲染器 ---------------- */
function initLabelRenderer () {
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(512, 512)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  container.value.appendChild(labelRenderer.domElement)
}

/* ---------------- 加载 OBJ + MTL ---------------- */
function loadModels () {
  group = new THREE.Group()
  scene.add(group)

  const models = [
    { name: '膀胱', obj: '/model/bladder_ge.obj', mtl: '/model/bladder_ge.mtl' },
    { name: '卵巢', obj: '/model/ovaries_ge.obj', mtl: '/model/ovaries_ge.mtl' },
    { name: '盆骨', obj: '/model/pelvis_ge.obj', mtl: '/model/pelvis_ge.mtl' },
    { name: '直肠', obj: '/model/rectum_ge.obj', mtl: '/model/rectum_ge.mtl' },
    { name: '尿道', obj: '/model/urethra_ge.obj', mtl: '/model/urethra_ge.mtl' },
    { name: '输卵管', obj: '/model/uterine_tube_ge.obj', mtl: '/model/uterine_tube_ge.mtl' },
    { name: '子宫', obj: '/model/uterus_ge.obj', mtl: '/model/uterus_ge.mtl' },
    { name: '阴道', obj: '/model/vagina_ge.obj', mtl: '/model/vagina_ge.mtl' }
  ]

  models.forEach((cfg, index) => {
    const mtlLoader = new MTLLoader()
    mtlLoader.load(cfg.mtl, (materials) => {
      materials.preload()

      const objLoader = new OBJLoader()
      objLoader.setMaterials(materials)

      objLoader.load(cfg.obj, (obj) => {
        obj.name = cfg.name
        obj.position.set(0, 0, 0)
        group.add(obj)

        // 添加角标
        addLabel(obj, cfg.name)
        obj.traverse(o => {
          if (o.isMesh && o.material?.color) {
            originalColors.set(o, o.material.color.clone())
          }
        })
        // 计算爆炸方向
        const angle = (index / models.length) * Math.PI * 2
        parts.push({
          object: obj,
          origin: obj.position.clone(),
          direction: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
        })
      })
    })
  })
}

/* ---------------- 爆炸 / 组合 ---------------- */
function toggleExplode () {
  exploded.value = !exploded.value
  const distance = 100

  parts.forEach(p => {
    if (exploded.value) {
      p.object.position
        .copy(p.origin)
        .add(p.direction.clone().multiplyScalar(distance))
    } else {
      p.object.position.copy(p.origin)
    }
  })
}

/* ---------------- 点击选中 ---------------- */
function onClick (e) {
  if (isDragging) return
  if (!exploded.value) return

  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(group.children, true)
  if (!hits.length) return

  const hitMesh = hits[0].object
  const rootObj = findRootPart(hitMesh)

  // 👉 进入单部位查看
  enterSingleView(rootObj.name)
}
function findRootPart (mesh) {
  let o = mesh
  while (o.parent && o.parent !== group) {
    o = o.parent
  }
  return o
}
function enterSingleView (partName) {
  viewMode.value = 'single'
  activePartName.value = partName

  group.children.forEach(obj => {
    obj.visible = obj.name === partName
  })

  // 相机聚焦
  const targetObj = group.children.find(o => o.name === partName)
  if (targetObj) {
    controls.target.copy(
      targetObj.getWorldPosition(new THREE.Vector3())
    )
    controls.update()
  }
  // 👉 隐藏所有角标
  setLabelsVisible(false)
}
// 点击按钮切换
function switchPart (part) {
  activePartName.value = part.key

  group.children.forEach(obj => {
    obj.visible = obj.name === part.label
  })

  const targetObj = group.children.find(o => o.name === part.label)
  if (targetObj) {
    controls.target.copy(
      targetObj.getWorldPosition(new THREE.Vector3())
    )
    controls.update()
  }
}
//复原图形
function exitSingleView () {
  viewMode.value = 'overview'
  activePartName.value = null

  group.children.forEach(obj => {
    obj.visible = true
  })
  // 👉 隐藏所有角标
  setLabelsVisible(true)
  controls.target.set(0, 0, 0)
  controls.update()
}
/* ---------------- 渲染循环 ---------------- */
function animate () {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

/* ---------------- 角标 ---------------- */
function addLabel (object, text) {
  // 引导线
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 25, 0)
  ]
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.Line(lineGeo, lineMat)

  // Sprite 标签
  const sprite = createTextSprite(text)
  sprite.position.set(0, 35, 0)

  const tagGroup = new THREE.Group()
  tagGroup.userData.isLabel = true
  tagGroup.add(line)
  tagGroup.add(sprite)

  object.add(tagGroup)
}
function setLabelsVisible (visible) {
  group.traverse(o => {
    if (o.userData?.isLabel) {
      o.visible = visible
    }
  })
}

function createTextSprite (text) {
  const dpr = window.devicePixelRatio || 1
  const scaleFactor = 2.5 // 清晰度倍率（2~3）

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const width = 512 * dpr * scaleFactor
  const height = 128 * dpr * scaleFactor

  canvas.width = width
  canvas.height = height

  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, width, height)

  // 文字
  ctx.fillStyle = '#ffffff'
  ctx.font = `${48 * dpr * scaleFactor}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })

  const sprite = new THREE.Sprite(material)

  // ⚠️ 这里只控制“世界中的显示尺寸”
  sprite.scale.set(50, 12, 1)

  return sprite
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  initThree()
  initLabelRenderer()
  loadModels()
  animate()
  window.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onClick)
  renderer.dispose()
})
</script>

<style scoped>
.wrapper {
  position: relative;
  width: 1440px;
}

.viewer {
  position: relative;
  width: 1440px;
  height: 800px;
}

.control-btn {
  position: absolute;
  top: 0;
  left: 10px;
  display: flex;
  flex-direction: column;
}

.part-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 10px;
}

.btn {
  margin-top: 8px;
  padding: 6px 12px;
}

.label {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.part-bar {
  display: flex;
  margin-top: 12px;
}

.part-btn {
  width: 98px;
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 6px 10px;
  background: #0D1326;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  margin-right: 16px;
}

.part-btn.active {
  background: #409eff;
  color: #fff;
}

.part-btn .icon {
  width: 60px;
  height: 60px;
}

.back {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 12px;
}

.part-btn.back {
  margin-left: auto;
  background: #ddd;
}
</style>