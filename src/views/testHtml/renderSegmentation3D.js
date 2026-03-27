// 必须先加载 Geometry Profile！这是 VTK.js 正常工作的关键
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';

/**
 * 使用 VTK.js 的 Marching Cubes 算法将分割体积数据渲染为 3D 表面模型
 * 
 * @param {HTMLElement} container - 渲染容器
 * @param {Object} volume - 体积数据对象
 * @param {Array} volume.dims - 维度 [x, y, z]
 * @param {Array} volume.spacing - 体素间距 [sx, sy, sz]
 * @param {TypedArray} volume.scalars - 分割标量数据（0表示背景，>0表示分割区域）
 */
export function renderSegmentation3D(container, volume) {
  const { dims, spacing, scalars } = volume;

  console.log('=== 开始3D渲染 ===');
  console.log('体积维度:', dims);
  console.log('体素间距:', spacing);
  console.log('标量数据长度:', scalars.length);

  // 验证输入数据
  let nonZeroCount = 0;
  for (let i = 0; i < scalars.length; i++) {
    if (scalars[i] > 0) nonZeroCount++;
  }
  console.log('非零体素数量:', nonZeroCount);

  if (nonZeroCount === 0) {
    console.warn('警告：没有分割数据（所有值都是0）');
    return;
  }

  // 创建 VTK ImageData
  const imageData = vtkImageData.newInstance();
  imageData.setDimensions(dims[0], dims[1], dims[2]);
  imageData.setSpacing(spacing[0], spacing[1], spacing[2]);
  imageData.setOrigin(0, 0, 0);

  // 将分割数据转换为 Float32Array（VTK.js 推荐使用）
  const floatScalars = new Float32Array(scalars.length);
  for (let i = 0; i < scalars.length; i++) {
    floatScalars[i] = scalars[i] > 0 ? 1.0 : 0.0;
  }

  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1,
    values: floatScalars,
    dataType: 'Float32Array',
    name: 'Scalars'
  });
  imageData.getPointData().setScalars(dataArray);

  console.log('ImageData 创建完成:');
  console.log('  dimensions:', imageData.getDimensions());
  console.log('  spacing:', imageData.getSpacing());
  console.log('  extent:', imageData.getExtent());
  console.log('  标量范围:', imageData.getPointData().getScalars().getRange());

  // 创建 Marching Cubes 过滤器
  const mc = vtkImageMarchingCubes.newInstance({
    contourValue: 0.5,  // 对于二值数据（0和1），使用0.5作为等值面阈值
    computeNormals: true,
    mergePoints: true
  });

  mc.setInputData(imageData);
  mc.update();

  const outputData = mc.getOutputData();
  const points = outputData.getPoints();
  const polys = outputData.getPolys();

  const pointCount = points ? points.getNumberOfPoints() : 0;
  const cellCount = polys ? polys.getNumberOfCells() : 0;

  console.log('=== Marching Cubes 结果 ===');
  console.log('  顶点数:', pointCount);
  console.log('  面片数:', cellCount);

  if (pointCount === 0) {
    console.error('Marching Cubes 没有生成任何几何体');
    return;
  }

  // 创建渲染管线
  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(mc.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);

  // 设置分割模型的外观（绿色，完全不透明）
  actor.getProperty().setColor(0.1, 0.85, 0.3);  // 亮绿色
  actor.getProperty().setOpacity(1.0);
  actor.getProperty().setAmbient(0.2);
  actor.getProperty().setDiffuse(0.8);
  actor.getProperty().setSpecular(0.3);
  actor.getProperty().setSpecularPower(20);

  // 创建渲染器
  const renderer = vtkRenderer.newInstance({
    background: [0.1, 0.1, 0.15]  // 深色背景
  });
  renderer.addActor(actor);
  renderer.resetCamera();

  // 调整相机视角
  const camera = renderer.getActiveCamera();
  camera.zoom(1.3);
  camera.elevation(20);  // 稍微倾斜视角

  // 创建渲染窗口
  const renderWindow = vtkRenderWindow.newInstance();
  renderWindow.addRenderer(renderer);

  // 创建 WebGL 渲染窗口
  const glrw = vtkOpenGLRenderWindow.newInstance();
  glrw.setContainer(container);

  // 设置渲染尺寸
  const containerRect = container.getBoundingClientRect();
  const width = containerRect.width || 300;
  const height = containerRect.height || 300;
  glrw.setSize(width, height);

  console.log('渲染容器尺寸:', width, 'x', height);

  renderWindow.addView(glrw);

  // 创建交互器
  const interactor = vtkRenderWindowInteractor.newInstance();
  interactor.setView(glrw);
  interactor.initialize();
  interactor.bindEvents(container);
  interactor.setInteractorStyle(
    vtkInteractorStyleTrackballCamera.newInstance()
  );

  // 执行渲染
  renderWindow.render();
  interactor.start();

  console.log('=== 3D渲染完成! ===');

  // 返回清理函数，用于在组件销毁时释放资源
  return function cleanup() {
    console.log('清理 VTK 资源...');
    interactor.unbindEvents();
    glrw.delete();
    renderWindow.delete();
    renderer.delete();
  };
}
