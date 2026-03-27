import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function renderSegmentation3D (
  container,
  segVolume
) {
  const { dimensions, spacing } = segVolume;
  const voxelManager = segVolume.voxelManager;

  const scalarData =
    voxelManager.getCompleteScalarDataArray();

  if (!scalarData || scalarData.length === 0) {
    console.error('Segmentation volume has no scalar data');
    return;
  }

  /* ---------- Scene ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  const gltfLoader = new GLTFLoader();

  gltfLoader.load('/public/model/vein.obj', function (object) {
    console.log(object)
    scene.add(object.scene);
  });

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    10000
  );
  camera.position.set(0, 0, 300);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  /* ---------- Light ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 1, 1);
  scene.add(dir);

  /* ---------- Controls ---------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;

  /* ---------- Marching Cubes ---------- */
  const material = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const resolution = 128;

  const mc = new MarchingCubes(
    resolution,
    material,
    true,
    true
  );

  // 🔥 非常关键
  mc.reset();

  // isolation 对二值 segmentation，必须 < 1
  mc.isolation = 0.5;

  const field = mc.field; // Float32Array
  const size = resolution;

  const [nx, ny, nz] = segVolume.dimensions;
  const data =
    segVolume.voxelManager.getCompleteScalarDataArray();

  // 清空 field
  field.fill(0);

  // 🔥 写连续标量场（不是 setCell）
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const v = data[z * nx * ny + y * nx + x];
        if (v === 0) continue;

        const ix = Math.floor((x / nx) * (size - 1));
        const iy = Math.floor((y / ny) * (size - 1));
        const iz = Math.floor((z / nz) * (size - 1));

        const idx = ix + iy * size + iz * size * size;

        // 🔥 关键：不是 1，而是 > isolation
        field[idx] = 1.0;
      }
    }
  }

  // 居中
  mc.position.set(-size / 2, -size / 2, -size / 2);

  scene.add(mc);
  scene.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    )
  );
  // 相机
  camera.position.set(0, 0, size * 2);
  camera.lookAt(0, 0, 0);

  /* ---------- Render ---------- */
  function animate () {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
