<script setup>
import {
  volumeLoader,
  RenderingEngine,
  Enums as csEnums,
  setVolumesForViewports,
  eventTarget,
  imageLoader
} from "@cornerstonejs/core";
import {
  ToolGroupManager,
  addTool,
  StackScrollTool, Enums as cstEnums,
  ZoomTool,
  WindowLevelTool,
} from "@cornerstonejs/tools";
import {
  cornerstoneNiftiImageLoader,
  createNiftiImageIdsAndCacheMetadata,
  Enums as niftiEnum,
} from '@cornerstonejs/nifti-volume-loader';
import initCornerstone from "../../cornerstone/helper/initCornerstone";
import destoryCS from "../../cornerstone/helper/destoryCS";

const renderingEngineId = 'my_renderingEngine';
let loading = ref(true)
const sliceIndex = ref(0);
const maxSlice = ref(0);
let renderingEngine;
let volume;
const viewportId1 = "CT_AXIAL";
const groupId = "group_id";
onMounted(() => {
  init();
})

onBeforeUnmount(() => {
  destoryCS(renderingEngineId)
})

eventTarget.addEventListener(niftiEnum.Events.NIFTI_VOLUME_LOADED, () => {
  loading.value = false;
})
eventTarget.addEventListener(
  csEnums.Events.VOLUME_VIEWPORT_SCROLL,
  () => {
    const viewport = renderingEngine.getViewport(viewportId1);
    if (!viewport || !volume) return;

    sliceIndex.value = getCurrentSliceIndex(viewport, volume);
    console.log('sliceIndex触发', sliceIndex.value);
  }
);
async function init () {
  await initCornerstone();

  imageLoader.registerImageLoader('nifti', cornerstoneNiftiImageLoader);
  // 在定义volumeId时使用 nifti 前缀，便于识别使用的加载器种类
  const niftiURL = window.location.origin + "/T1_MPRAG.nii";
  const volumeId = 'niftiVolume';
  const imageIds = await createNiftiImageIdsAndCacheMetadata({ url: niftiURL });
  volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds,
  });

  renderingEngine = new RenderingEngine(renderingEngineId);
  // 在渲染引擎中创建并加载视图，使视图与HTML元素绑定
  const viewportInputArray = [
    {
      viewportId: viewportId1,
      type: csEnums.ViewportType.ORTHOGRAPHIC,
      element: document.querySelector("#element1"),
      defaultOptions: {
        orientation: csEnums.OrientationAxis.AXIAL,
      }
    },
  ];
  renderingEngine.setViewports(viewportInputArray);

  maxSlice.value = volume.dimensions[2] - 1;
  console.log('maxSlice', maxSlice.value);
  // 在视图上设置Volume
  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: volumeId,
      },
    ],
    [viewportId1]
  );
  addTools()
  await volume.load();

  // 渲染图像
  renderingEngine.renderViewports([viewportId1]);
  const viewport = renderingEngine.getViewport(viewportId1);
  sliceIndex.value = getCurrentSliceIndex(viewport, volume);
}
function addTools () {
  const toolGroup = ToolGroupManager.createToolGroup(groupId);

  addTool(StackScrollTool);
  addTool(WindowLevelTool);
  addTool(ZoomTool);

  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: cstEnums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: cstEnums.MouseBindings.Wheel }],
  })
  toolGroup.addViewport(viewportId1, renderingEngineId);
}
function handleSliderChange (e) {
  const value = Number(e.target.value);
  sliceIndex.value = value;

  const viewport = renderingEngine.getViewport(viewportId1);
  setSliceIndex(viewport, value);
}
// 获取当前的切片索引
function getCurrentSliceIndex (viewport, volume) {
  const camera = viewport.getCamera();
  const { direction, spacing, origin } = volume;
  const normal = direction.slice(6, 9); // axial normal

  const worldPos = camera.focalPoint;
  const diff = [
    worldPos[0] - origin[0],
    worldPos[1] - origin[1],
    worldPos[2] - origin[2],
  ];

  const distance =
    diff[0] * normal[0] +
    diff[1] * normal[1] +
    diff[2] * normal[2];

  return Math.round(distance / spacing[2]);
}
function setSliceIndex (viewport, sliceIndex) {
  const currentRef = viewport.getViewReference?.()
  const viewRef = {
    ...currentRef, // 你当前的 volumeId
    sliceIndex, // 要跳到的切片索引
  }
  viewport.setViewReference(viewRef)
  viewport.render();
}
function handleMinus () {
  if (sliceIndex.value > 0) {
    sliceIndex.value -= 1;
    const viewport = renderingEngine.getViewport(viewportId1);
    setSliceIndex(viewport, sliceIndex.value);
  }
}
function handlePlus () {
  if (sliceIndex.value < maxSlice.value) {
    sliceIndex.value += 1;
    const viewport = renderingEngine.getViewport(viewportId1);
    setSliceIndex(viewport, sliceIndex.value);
  }
}

</script>

<template>
  <div>
    <div id="demo-wrap">
      <div id="element1" v-loading="loading" class="cornerstone-item" element-loading-text="Loading..."
        element-loading-background="rgba(6, 28, 73, 0.2)" />
    </div>
    <div className="slider-container">
      <div className="slider-label">
        <span>切片索引:</span>
        <span>
          {{ sliceIndex }}/ {{ maxSlice }}
        </span>
      </div>
      <el-icon @click="handleMinus">
        <Minus />
      </el-icon>
      <input class="slider-input" type="range" :min="0" :max="maxSlice" v-model="sliceIndex"
        @input="handleSliderChange" />
      <el-icon @click="handlePlus">
        <Plus />
      </el-icon>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.cornerstone-item {
  display: inline-block;
  width: 520px;
  height: 480px;
  margin-top: 20px;
  margin-right: 20px;
  padding: 0;
  border: 2px solid #96CDF2;
  border-radius: 10px;
}

.slider-input {
  width: 93%;
}
</style>
