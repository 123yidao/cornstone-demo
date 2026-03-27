import pako from 'pako';

/**
 * Browser-safe NIfTI-1 export (NO Buffer, NO node)
 * 
 * 修复版本：完整的 NIfTI-1 header，包含仿射变换矩阵
 */
export function exportSegmentationAsNifti(
  baseVolume,
  segVolume,
  { fileName = 'segmentation_mask.nii.gz' } = {}
) {
  // 获取分割数据
  let scalarData;
  if (segVolume.voxelManager && typeof segVolume.voxelManager.getCompleteScalarDataArray === 'function') {
    scalarData = segVolume.voxelManager.getCompleteScalarDataArray();
  } else if (segVolume.getScalarData) {
    scalarData = segVolume.getScalarData();
  } else if (segVolume.scalarData) {
    scalarData = segVolume.scalarData;
  } else {
    console.error('无法获取 scalar data');
    return;
  }

  const dims = segVolume.dimensions;
  const [nx, ny, nz] = dims;

  // 使用 baseVolume 的空间信息
  const spacing = baseVolume.spacing || segVolume.spacing;
  const origin = baseVolume.origin || segVolume.origin || [0, 0, 0];
  const direction = baseVolume.direction || segVolume.direction;

  console.log('导出 NIfTI - dimensions:', dims);
  console.log('导出 NIfTI - spacing:', spacing);
  console.log('导出 NIfTI - origin:', origin);
  console.log('导出 NIfTI - direction:', direction);

  /* -----------------------------
   * 1. 创建 mask 数据 (uint8)
   * ----------------------------- */
  const voxelCount = nx * ny * nz;
  const mask = new Uint8Array(voxelCount);

  let nonZeroCount = 0;
  for (let i = 0; i < voxelCount; i++) {
    if (scalarData[i] > 0) {
      mask[i] = 1;
      nonZeroCount++;
    } else {
      mask[i] = 0;
    }
  }

  console.log('导出 NIfTI - 非零体素数量:', nonZeroCount);

  if (nonZeroCount === 0) {
    console.warn('警告：分割数据全为空，没有有效的分割区域');
  }

  /* -----------------------------
   * 2. 创建 NIfTI-1 header (348 bytes)
   * NIfTI-1 规范: https://nifti.nimh.nih.gov/nifti-1/
   * ----------------------------- */
  const headerBuffer = new ArrayBuffer(348);
  const dv = new DataView(headerBuffer);
  const headerBytes = new Uint8Array(headerBuffer);

  // ========== 基本信息 ==========
  // sizeof_hdr: offset 0, int32 - 必须是 348
  dv.setInt32(0, 348, true);

  // data_type[10]: offset 4 - 未使用，保持为0
  // db_name[18]: offset 14 - 未使用，保持为0
  // extents: offset 32, int32 - 未使用
  // session_error: offset 36, int16 - 未使用
  // regular: offset 38, char - 未使用
  // dim_info: offset 39, char - 未使用

  // ========== 维度信息 ==========
  // dim[8]: offset 40, int16[8]
  // dim[0] = 维度数量 (3 表示 3D)
  dv.setInt16(40, 3, true);  // dim[0] - 3D 数据
  dv.setInt16(42, nx, true); // dim[1] - X 方向大小
  dv.setInt16(44, ny, true); // dim[2] - Y 方向大小
  dv.setInt16(46, nz, true); // dim[3] - Z 方向大小
  dv.setInt16(48, 1, true);  // dim[4] - 时间维度（设为1）
  dv.setInt16(50, 1, true);  // dim[5]
  dv.setInt16(52, 1, true);  // dim[6]
  dv.setInt16(54, 1, true);  // dim[7]

  // intent_p1, intent_p2, intent_p3: offset 56-68, float32 - 未使用
  // intent_code: offset 68, int16 - 未使用

  // ========== 数据类型 ==========
  // datatype: offset 70, int16
  // 2 = NIFTI_TYPE_UINT8
  dv.setInt16(70, 2, true);

  // bitpix: offset 72, int16 - 每个体素的位数
  dv.setInt16(72, 8, true);  // 8 bits = 1 byte for uint8

  // slice_start: offset 74, int16 - 未使用

  // ========== 像素尺寸 ==========
  // pixdim[8]: offset 76, float32[8]
  // pixdim[0] 用于 qform，通常设为 1.0
  dv.setFloat32(76, 1.0, true);  // pixdim[0] - qfac，用于确定坐标系手性
  dv.setFloat32(80, spacing[0], true);  // pixdim[1] - X spacing
  dv.setFloat32(84, spacing[1], true);  // pixdim[2] - Y spacing
  dv.setFloat32(88, spacing[2], true);  // pixdim[3] - Z spacing
  dv.setFloat32(92, 1.0, true);  // pixdim[4] - 时间间隔
  dv.setFloat32(96, 1.0, true);  // pixdim[5]
  dv.setFloat32(100, 1.0, true); // pixdim[6]
  dv.setFloat32(104, 1.0, true); // pixdim[7]

  // ========== 数据偏移 ==========
  // vox_offset: offset 108, float32 - 数据开始的字节偏移
  // 对于 .nii 文件，最小值是 352（348 header + 4 extension）
  dv.setFloat32(108, 352, true);

  // scl_slope: offset 112, float32 - 缩放斜率
  dv.setFloat32(112, 1.0, true);  // 不缩放

  // scl_inter: offset 116, float32 - 缩放截距
  dv.setFloat32(116, 0.0, true);

  // slice_end: offset 120, int16
  // slice_code: offset 122, char
  // xyzt_units: offset 123, char
  // 设置单位: NIFTI_UNITS_MM (2) + NIFTI_UNITS_SEC (8) = 10
  dv.setUint8(123, 2);  // 空间单位为毫米

  // cal_max: offset 124, float32
  dv.setFloat32(124, 1.0, true);

  // cal_min: offset 128, float32
  dv.setFloat32(128, 0.0, true);

  // slice_duration: offset 132, float32
  // toffset: offset 136, float32
  // glmax: offset 140, int32 (deprecated)
  // glmin: offset 144, int32 (deprecated)

  // descrip[80]: offset 148 - 描述字符串
  const description = 'Segmentation mask exported from Cornerstone3D';
  for (let i = 0; i < Math.min(description.length, 80); i++) {
    headerBytes[148 + i] = description.charCodeAt(i);
  }

  // aux_file[24]: offset 228 - 辅助文件名

  // ========== 坐标变换 ==========
  // qform_code: offset 252, int16
  // 1 = NIFTI_XFORM_SCANNER_ANAT
  dv.setInt16(252, 1, true);

  // sform_code: offset 254, int16
  // 1 = NIFTI_XFORM_SCANNER_ANAT
  dv.setInt16(254, 1, true);

  // ========== 构建仿射矩阵 ==========
  // 仿射矩阵将体素坐标 (i,j,k) 转换为世界坐标 (x,y,z)
  // [x]   [srow_x[0] srow_x[1] srow_x[2] srow_x[3]]   [i]
  // [y] = [srow_y[0] srow_y[1] srow_y[2] srow_y[3]] * [j]
  // [z]   [srow_z[0] srow_z[1] srow_z[2] srow_z[3]]   [k]
  // [1]   [   0         0         0         1     ]   [1]

  // 从 direction 矩阵构建（3x3 旋转矩阵，按列存储）
  // direction = [r00, r10, r20, r01, r11, r21, r02, r12, r22]
  // 即: 第一列 [r00, r10, r20] 是 X 方向
  //     第二列 [r01, r11, r21] 是 Y 方向
  //     第三列 [r02, r12, r22] 是 Z 方向

  let srow_x, srow_y, srow_z;

  if (direction && direction.length >= 9) {
    // 有方向矩阵，构建完整的仿射变换
    // srow_x = [dir[0]*sp[0], dir[3]*sp[1], dir[6]*sp[2], origin[0]]
    srow_x = [
      direction[0] * spacing[0],
      direction[3] * spacing[1],
      direction[6] * spacing[2],
      origin[0]
    ];
    srow_y = [
      direction[1] * spacing[0],
      direction[4] * spacing[1],
      direction[7] * spacing[2],
      origin[1]
    ];
    srow_z = [
      direction[2] * spacing[0],
      direction[5] * spacing[1],
      direction[8] * spacing[2],
      origin[2]
    ];
  } else {
    // 没有方向矩阵，使用默认的单位矩阵
    srow_x = [spacing[0], 0, 0, origin[0]];
    srow_y = [0, spacing[1], 0, origin[1]];
    srow_z = [0, 0, spacing[2], origin[2]];
  }

  console.log('srow_x:', srow_x);
  console.log('srow_y:', srow_y);
  console.log('srow_z:', srow_z);

  // quatern_b, quatern_c, quatern_d: offset 256-268, float32 - 四元数（用于 qform）
  // qoffset_x, qoffset_y, qoffset_z: offset 268-280, float32 - 用于 qform
  // 设置 qoffset（即使主要使用 sform）
  dv.setFloat32(268, origin[0], true); // qoffset_x
  dv.setFloat32(272, origin[1], true); // qoffset_y
  dv.setFloat32(276, origin[2], true); // qoffset_z

  // srow_x[4]: offset 280, float32[4]
  dv.setFloat32(280, srow_x[0], true);
  dv.setFloat32(284, srow_x[1], true);
  dv.setFloat32(288, srow_x[2], true);
  dv.setFloat32(292, srow_x[3], true);

  // srow_y[4]: offset 296, float32[4]
  dv.setFloat32(296, srow_y[0], true);
  dv.setFloat32(300, srow_y[1], true);
  dv.setFloat32(304, srow_y[2], true);
  dv.setFloat32(308, srow_y[3], true);

  // srow_z[4]: offset 312, float32[4]
  dv.setFloat32(312, srow_z[0], true);
  dv.setFloat32(316, srow_z[1], true);
  dv.setFloat32(320, srow_z[2], true);
  dv.setFloat32(324, srow_z[3], true);

  // intent_name[16]: offset 328 - 未使用

  // ========== Magic Number ==========
  // magic[4]: offset 344
  // 对于 .nii 单文件格式: "n+1\0"
  dv.setUint8(344, 0x6e); // 'n'
  dv.setUint8(345, 0x2b); // '+'
  dv.setUint8(346, 0x31); // '1'
  dv.setUint8(347, 0x00); // '\0'

  /* -----------------------------
   * 3. 创建扩展区域 (4 bytes)
   * ----------------------------- */
  // NIfTI-1 在 header 和 data 之间有 4 字节的扩展区
  // 如果没有扩展，全部设为 0
  const extensionBuffer = new ArrayBuffer(4);
  // 默认已经是 0，表示没有扩展

  /* -----------------------------
   * 4. 拼接 header + extension + data
   * ----------------------------- */
  const totalSize = 348 + 4 + mask.byteLength; // 352 + data
  const combined = new Uint8Array(totalSize);
  combined.set(new Uint8Array(headerBuffer), 0);
  combined.set(new Uint8Array(extensionBuffer), 348);
  combined.set(mask, 352);

  /* -----------------------------
   * 5. gzip 并下载
   * ----------------------------- */
  const gzipped = pako.gzip(combined);

  downloadBlob(
    new Blob([gzipped], { type: 'application/gzip' }),
    fileName
  );

  console.log('✅ NIfTI mask exported:', fileName);
  console.log('   文件大小:', gzipped.length, 'bytes (gzipped)');
  console.log('   原始大小:', combined.length, 'bytes');
  console.log('   维度:', nx, 'x', ny, 'x', nz);
  console.log('   非零体素:', nonZeroCount);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
