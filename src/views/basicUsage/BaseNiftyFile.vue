<script setup>
import {
  volumeLoader,
  RenderingEngine,
  Enums as csEnums,
  setVolumesForViewports,
  eventTarget,
  metaData,
  imageLoader,
  cache,
} from "@cornerstonejs/core";
import {
  cornerstoneNiftiImageLoader,
  createNiftiImageIdsAndCacheMetadata,
  Enums as niftiEnum,
} from '@cornerstonejs/nifti-volume-loader';
import {
  Enums as cstEnums,
  segmentation,
  ToolGroupManager,
  addTool,
  BrushTool, StackScrollTool, Enums as csToolsEnums,
  PanTool,
  ZoomTool,
  DragProbeTool,
  WindowLevelTool,
} from "@cornerstonejs/tools";
import initCornerstone from "../../cornerstone/helper/initCornerstone";
import destoryCS from "../../cornerstone/helper/destoryCS";
import {
  adaptersSEG,
  helpers
} from "@cornerstonejs/adapters";
import { renderSegmentation3D } from '../testHtml/renderSegmentation3D.js';
import { exportSegmentationAsNifti } from '../testHtml/exportNiftiMask.js';
import dcmjs from "dcmjs";
const renderingEngineId = 'my_renderingEngine_3';
let loading = ref(true)

const baseTools = [
  {
    tool: PanTool,
    zh: '平移工具',
  },
  {
    tool: BrushTool,
    zh: '刷子工具',
  },
  {
    tool: DragProbeTool,
    zh: '探针工具',
  },
  {
    tool: WindowLevelTool,
    zh: '窗宽窗距调整工具',
  },
  {
    tool: ZoomTool,
    zh: '缩放',
  },
  {
    tool: StackScrollTool,
    zh: '鼠标点击及拖动切换层级',
  },
]
const checkedTool = ref(PanTool.toolName)
const groupId = "group_id";
const viewportId1 = "CT_AXIAL";
const viewportId2 = "CT_SAGITTAL";
const viewportId3 = "CT_CORONAL";

onMounted(() => {
  init();
})

onBeforeUnmount(() => {
  destoryCS(renderingEngineId)
})

eventTarget.addEventListener(niftiEnum.Events.NIFTI_VOLUME_LOADED, () => {
  loading.value = false;
})

async function init () {
  await initCornerstone();

  // 1.0版本
  // step1: 注册一个nifti格式的加载器
  // volumeLoader.registerVolumeLoader(
  //   "nifti",
  //   cornerstoneNiftiImageVolumeLoader
  // );
  // ==========================================================
  // 2.0版本
  // 在2.0版本中主要基于image进行渲染，由注册volume更新为注册imageLoader
  imageLoader.registerImageLoader('nifti', cornerstoneNiftiImageLoader);

  // step2: 声明volumeId，格式为 'nifti:'+真实的请求路径
  // 在定义volumeId时使用 nifti 前缀，便于识别使用的加载器种类
  const niftiURL =
    "http://192.168.110.99:8088/api/get-nifti-file?filename=002_T1_MPRAGE_TRA_iso1_0.nii";
  // 1.0版本：由于注册的是volume，需要对volumeID进行处理;在2.0中不需要
  // const volumeId = "nifti:" + niftiURL;
  const volumeId = 'niftiVolume';
  // ==========================================================
  // 2.0版本：自动对nifti进行处理，生成 以 nifti:为前缀的imageId
  const imageIds = await createNiftiImageIdsAndCacheMetadata({ url: niftiURL });
  const volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds,
  });

  const renderingEngine = new RenderingEngine(renderingEngineId);
  // 在渲染引擎中创建并加载视图，使视图与HTML元素绑定

  const viewportInputArray = [
    {
      viewportId: viewportId1,
      type: csEnums.ViewportType.ORTHOGRAPHIC,
      element: document.querySelector("#element1"),
      defaultOptions: {
        orientation: csEnums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportId2,
      type: csEnums.ViewportType.ORTHOGRAPHIC,
      element: document.querySelector("#element2"),
      defaultOptions: {
        orientation: csEnums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportId3,
      type: csEnums.ViewportType.ORTHOGRAPHIC,
      element: document.querySelector("#element3"),
      defaultOptions: {
        orientation: csEnums.OrientationAxis.CORONAL,
      },
    },
  ];
  renderingEngine.setViewports(viewportInputArray);

  // 全局注册工具
  addTools();

  // 激活默认激活的工具
  activeDefaultTools();
  // 在视图上设置Volume
  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: volumeId,
      },
    ],
    [viewportId1, viewportId2, viewportId3]
  );

  await volume.load();
  initSegmentation(volumeId)

  // 渲染图像
  renderingEngine.renderViewports([viewportId1, viewportId2, viewportId3]);
}
async function initSegmentation (volumeId) {
  const segmentationId = 'my_segmentation';
  const segmentationVolumeId = `SEG_${volumeId}`;

  const derivedVolume = await volumeLoader.createAndCacheDerivedLabelmapVolume(volumeId, {
    volumeId: segmentationVolumeId,
  });

  segmentation.addSegmentations([
    {
      segmentationId,
      representation: {
        type: cstEnums.SegmentationRepresentations.Labelmap,
        data: {
          volumeId: segmentationVolumeId,
        },
      },
    },
  ]);
  const segmentationRepresentation = {
    segmentationId,
    type: csToolsEnums.SegmentationRepresentations.Labelmap,
  };
  await segmentation.addLabelmapRepresentationToViewportMap({
    [viewportId1]: [segmentationRepresentation],
    [viewportId2]: [segmentationRepresentation],
    [viewportId3]: [segmentationRepresentation],
  });

  await derivedVolume.load();
}


function addTools () {
  const toolGroup = ToolGroupManager.createToolGroup(groupId);

  addTool(PanTool);
  addTool(StackScrollTool);
  addTool(BrushTool);
  addTool(DragProbeTool);
  addTool(WindowLevelTool);
  addTool(ZoomTool);

  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(DragProbeTool.toolName);
  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);

  toolGroup.addToolInstance(
    'CircularBrush',
    BrushTool.toolName,
    {
      activeStrategy: 'FILL_INSIDE_CIRCLE',
      configuration: {
        radius: 4, // 👈 调小这里，单位是像素
      },
    }
  );
  toolGroup.setToolConfiguration('CircularBrush', {
    brushSize: 8, // 单位：mm（world space）
  });
  console.log(
    toolGroup.getToolConfiguration('CircularBrush')
  );
  toolGroup.addViewport(viewportId1, renderingEngineId);
  toolGroup.addViewport(viewportId2, renderingEngineId);
  toolGroup.addViewport(viewportId3, renderingEngineId);
}

function activeDefaultTools () {
  const toolGroup = ToolGroupManager.getToolGroup(groupId);
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: cstEnums.MouseBindings.Primary }],
  });
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: cstEnums.MouseBindings.Wheel }],
  })
}
function handleChange (toolName) {
  const toolGroup = ToolGroupManager.getToolGroup(groupId);

  // 统一禁用所有 primary tool
  [
    PanTool.toolName,
    DragProbeTool.toolName,
    WindowLevelTool.toolName,
    ZoomTool.toolName,
    'CircularBrush',
  ].forEach(name => {
    toolGroup.setToolDisabled(name);
  });

  if (toolName === BrushTool.toolName) {
    toolGroup.setToolActive('CircularBrush', {
      bindings: [{ mouseButton: cstEnums.MouseBindings.Primary }],
    });
  } else {
    toolGroup.setToolActive(toolName, {
      bindings: [{ mouseButton: cstEnums.MouseBindings.Primary }],
    });
  }
}
function load3dModel () {
  const container = document.querySelector('#element4');
  if (!container) {
    console.error('未找到容器 #element4');
    return;
  }

  // 清空容器中的旧canvas
  container.innerHTML = '';

  console.log('=== 开始生成3D模型 ===');

  const segVolume = getSegmentationVolume('my_segmentation');
  if (!segVolume) {
    console.error('未找到 segmentation volume');
    alert('未找到分割数据，请确保已创建分割');
    return;
  }

  console.log('segVolume:', segVolume);
  console.log('segVolume.dimensions:', segVolume.dimensions);
  console.log('segVolume.spacing:', segVolume.spacing);

  // 获取标量数据 - 兼容不同版本的API
  let scalarData;
  if (segVolume.voxelManager && typeof segVolume.voxelManager.getCompleteScalarDataArray === 'function') {
    scalarData = segVolume.voxelManager.getCompleteScalarDataArray();
  } else if (segVolume.getScalarData) {
    scalarData = segVolume.getScalarData();
  } else if (segVolume.scalarData) {
    scalarData = segVolume.scalarData;
  } else {
    console.error('无法获取 scalar data，可用属性:', Object.keys(segVolume));
    return;
  }

  const dims = segVolume.dimensions;
  const spacing = segVolume.spacing;

  console.log('scalarData length:', scalarData.length);
  console.log('期望长度 (dims[0]*dims[1]*dims[2]):', dims[0] * dims[1] * dims[2]);

  // 统计非零值
  let nonZeroCount = 0;
  for (let i = 0; i < scalarData.length; i++) {
    if (scalarData[i] !== 0) {
      nonZeroCount++;
    }
  }

  console.log('非零值数量:', nonZeroCount, '总数:', scalarData.length);

  if (nonZeroCount === 0) {
    console.warn('labelmap 全为 0');
    alert('请先使用刷子工具在图像上绘制分割区域，然后再生成3D模型');
    return;
  }

  // 将数据转换为Float32Array以支持Marching Cubes插值
  const floatScalars = new Float32Array(scalarData.length);
  for (let i = 0; i < scalarData.length; i++) {
    floatScalars[i] = scalarData[i] > 0 ? 1.0 : 0.0;
  }

  renderSegmentation3D(container, {
    dims,
    spacing,
    scalars: floatScalars,
    contourValue: 1,
  });

  console.log('=== 3D模型生成完成 ===');
}

function handleExportSeg () {
  // 1️⃣ 获取 segmentation
  const seg = segmentation.state.getSegmentation('my_segmentation');
  if (!seg) {
    alert('未找到 segmentation');
    return;
  }

  // 2️⃣ 获取 segmentation volumeId
  const segVolumeId =
    seg.representationData?.Labelmap?.volumeId;

  if (!segVolumeId) {
    alert('未找到 segmentation volumeId');
    return;
  }

  // 3️⃣ 从 cache 中取 segmentation volume
  const segVolume = cache.getVolume(segVolumeId);
  if (!segVolume) {
    alert('segmentation volume 不存在');
    return;
  }

  // 4️⃣ 取原始 base volume（你 init 里创建的）
  const baseVolume = cache.getVolume('niftiVolume');
  if (!baseVolume) {
    alert('base volume 不存在');
    return;
  }

  // 5️⃣ 导出为 NIfTI mask
  exportSegmentationAsNifti(baseVolume, segVolume, {
    fileName: 'mySegmentationMask.nii.gz',
  });
}
function generateMockMetadata (segmentIndex, color) {
  const RecommendedDisplayCIELabValue = dcmjs.data.Colors.rgb2DICOMLAB(
    color.slice(0, 3).map(value => value / 255)
  ).map(value => Math.round(value));

  return {
    SegmentedPropertyCategoryCodeSequence: {
      CodeValue: "T-D0050",
      CodingSchemeDesignator: "SRT",
      CodeMeaning: "Tissue"
    },
    SegmentNumber: segmentIndex.toString(),
    SegmentLabel: "Tissue " + segmentIndex.toString(),
    SegmentAlgorithmType: "SEMIAUTOMATIC",
    SegmentAlgorithmName: "Slicer Prototype",
    RecommendedDisplayCIELabValue,
    SegmentedPropertyTypeCodeSequence: {
      CodeValue: "T-D0050",
      CodingSchemeDesignator: "SRT",
      CodeMeaning: "Tissue"
    }
  };
}
function getSegmentationVolume (segmentationId) {
  const seg = segmentation.state.getSegmentation(segmentationId);
  console.log('segmentation state:', seg);

  if (!seg) {
    console.error('找不到 segmentation:', segmentationId);
    return null;
  }

  console.log('representationData:', seg.representationData);

  // 尝试多种获取volumeId的方式
  let volumeId = null;

  if (seg.representationData?.Labelmap?.volumeId) {
    volumeId = seg.representationData.Labelmap.volumeId;
  } else if (seg.representationData?.LABELMAP?.volumeId) {
    volumeId = seg.representationData.LABELMAP.volumeId;
  } else if (seg.representationData?.volumeId) {
    volumeId = seg.representationData.volumeId;
  }

  console.log('找到的 volumeId:', volumeId);

  if (!volumeId) {
    console.error('无法获取 volumeId，representationData 结构:', JSON.stringify(seg.representationData, null, 2));
    return null;
  }

  const volume = cache.getVolume(volumeId);
  console.log('获取到的 volume:', volume);

  return volume;
}

function getSegmentationIds () {
  return segmentation.state.getAllSegmentationIds ?
    segmentation.state.getAllSegmentationIds() :
    segmentation.state.getSegmentations?.().map(s => s.segmentationId) || [];
}
</script>

<template>
  <div>
    <h3>加载渲染NifTi文件</h3>
    <el-button type="primary" @click="load3dModel">生成3d模型</el-button>
    <el-button type="primary" @click="handleExportSeg">导出mask</el-button>
    <div class="form-item">
      <label>交互工具：</label>
      <el-radio-group v-model="checkedTool" @change="handleChange">
        <el-radio v-for="(item, index) in baseTools" :key="index" class="radio-item" :value="item.tool.toolName">
          {{ item.zh }}（{{ item.tool.toolName }}）
        </el-radio>
      </el-radio-group>
    </div>
    <div id="demo-wrap">
      <div id="element1" v-loading="loading" class="cornerstone-item" element-loading-text="Loading..."
        element-loading-background="rgba(6, 28, 73, 0.2)" />
      <div id="element2" v-loading="loading" class="cornerstone-item" element-loading-text="Loading..."
        element-loading-background="rgba(6, 28, 73, 0.2)" />
      <div id="element3" v-loading="loading" class="cornerstone-item" element-loading-text="Loading..."
        element-loading-background="rgba(6, 28, 73, 0.2)" />
    </div>
    <div id="element4" class="cornerstone-item" element-loading-text="Loading..."
      element-loading-background="rgba(6, 28, 73, 0.2)" />
  </div>
</template>


<style lang="scss" scoped>
.cornerstone-item {
  display: inline-block;
  width: 300px;
  height: 300px;
  margin-top: 20px;
  margin-right: 20px;
  padding: 0;
  border: 2px solid #96CDF2;
  border-radius: 10px;
}

label {
  margin-right: 10px;
}
</style>
