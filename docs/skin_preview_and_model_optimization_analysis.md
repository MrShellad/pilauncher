# 皮肤预览与模型渲染优化及升级分析报告

本报告对 **Modrinth** 官方客户端源码（以下简称 Modrinth）与当前项目 **PiLauncher** 进行比对分析，针对 3D 皮肤预览及模型渲染相关的模块，指出现有实现的不足，并提出具体的优化和升级建议。

---

## 1. 概述与技术栈对比

两个项目均采用了基于 **Three.js** 的方块人模型（Classic 4px 手臂 / Slim 3px 手臂）渲染方案，但在架构组织和细节特效处理上存在差异：

| 维度 | Modrinth 方案 | PiLauncher 方案 | 优劣势分析 |
| :--- | :--- | :--- | :--- |
| **前端框架集成** | Vue 3 + **TresJS**（声明式 3D 框架） | React 18 + 自定义命令式类（**SkinEngine.ts**） | **TresJS** 便于在 Vue 中通过组件属性控制 3D 对象；PiLauncher 的 `SkinEngine` 作为单例类，利用自定义 React Hooks 挂载/卸载 Canvas，更契合 React 模式。 |
| **模型源与动画** | 内嵌动画 clip 的 GLTF 格式模型文件 | 内嵌动画 clip 的 GLTF 格式模型文件 | 均使用标准 Minecraft 模型资产，动画数据存储于 GLTF 中。 |
| **离屏渲染与缓存** | 单例 `BatchSkinRenderer` + IndexedDB | 单例 `ThumbnailRenderer` + IndexedDB | 均实现了将 3D 模型渲染为 Front/Back 的 WebP 并存储到 IndexedDB 缓存的机制。 |
| **第三方库依赖** | 完全自研 Three.js 渲染管线 | 混合使用自研 `SkinEngine` 与第三方 **`skinview3d`** | PiLauncher 在 `DonorSkinModal` 中使用了 `skinview3d`，导致项目包含两套渲染底座，存在依赖冗余。 |

---

## 2. 关键差异与升级建议

### 2.1 点击物理反馈与伤害闪红特效（Click Impulse & Damage Flash）

> [!NOTE]
> **Modrinth 实现方案**：
> 1. **点击物理形变（Click Impulse）**：每次点击 3D Canvas 时，`useSkinPreviewAnimation` 会增加 `clickImpulseEnergy`（点击能量），并通过帧循环更新形变状态。模型会产生物理性的“果冻挤压/拉伸”效果（Squash & Stretch）以及旋转和位置的随机微颤。
> 2. **伤害闪红（Damage Flash）**：当点击能量累加到阈值时，触发闪红。通过动态修改材质的 `onBeforeCompile`（在线修改 GLSL 着色器代码），将自定义 uniform `uDamageFlashColor` (`#bd2f2f`) 混入模型材质中，完美还原 Minecraft 游戏内实体受到伤害时的红色高亮效果。

* **当前项目现状**：
  PiLauncher 点击 Canvas 时仅触发播放 GLTF 的 `interact`（挥手）动画，没有物理形变抖动，也没有伤害闪红特效，交互体验较为生硬。
* **升级方案**：
  在 [modrinthSkinRendering.ts](file:///h:/VSCodeWork/pilauncher/src/features/home/engine/modrinthSkinRendering.ts) 中增加 `onBeforeCompile` 注入代码，并在 [SkinEngine.ts](file:///h:/VSCodeWork/pilauncher/src/features/home/engine/SkinEngine.ts) 中引入 `clickImpulseEnergy` 的阻尼衰减计算，实现完美的物理挤压反馈和 Minecraft 伤害闪红效果。

```typescript
// 材质动态闪红着色器注入代码示例
material.onBeforeCompile = (shader) => {
  shader.uniforms.uDamageFlashIntensity = { value: 0.0 };
  shader.uniforms.uDamageFlashColor = { value: new THREE.Color(0xbd2f2f) };
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nuniform float uDamageFlashIntensity;\nuniform vec3 uDamageFlashColor;'
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    'gl_FragColor.rgb = mix(gl_FragColor.rgb, uDamageFlashColor, uDamageFlashIntensity * gl_FragColor.a);\n#include <dithering_fragment>'
  );
};
```

---

### 2.2 深度冲突预防（Z-Fighting / Depth Fighting Prevention）

> [!IMPORTANT]
> **Modrinth 解决手段**：
> 3D 皮肤包含内层（Base Layer）和外层（Overlay Layer，如帽子、外袖、外套）。在渲染时，重叠的三角面在低角度或低分辨率下极易发生像素抖动和穿模（Z-fighting）。
> Modrinth 在设置材质属性时，判断如果是外层网格（名称以 `_Layer` 结尾），则显式开启 **`polygonOffset`** 并应用负偏移：
> ```typescript
> material.polygonOffset = isSkinLayer;
> material.polygonOffsetFactor = isSkinLayer ? -1 : 0;
> material.polygonOffsetUnits = isSkinLayer ? -1 : 0;
> ```
> 这会使外层的深度值稍微向相机靠近，确保绝对不会被内层穿透。

* **当前项目现状**：
  PiLauncher 的 `modrinthSkinRendering.ts` 在 `applyPlayerTexture` 函数中只设置了基本的 `alphaToCoverage = true` 和 `depthWrite = true`，但完全没有配置 `polygonOffset`，这使得当玩家旋转 3D 皮肤到极限切角或远距离缩放时，外层材质边缘可能会产生细微的深度闪烁闪烁。
* **升级方案**：
  在 `applyPlayerTexture` 的材质遍历步骤中，根据网格（Mesh）命名或结构，识别外层覆盖层（例如以 `_Layer` 结尾），并配置 `polygonOffsetFactor` 和 `polygonOffsetUnits` 为 `-1`。

---

### 2.3 自动相机对齐与构图适配（Dynamic Camera Auto-Fitting）

> [!NOTE]
> **Modrinth 实现方案**：
> Modrinth 并不使用硬编码的相机位置，而是通过 `useSkinPreviewFit.ts` 中的数学计算：
> 1. 利用 `getVisibleMeshBox` 计算模型当前在世界空间下的实际可见包围盒（AABB）。
> 2. 根据容器 Canvas 的纵横比（Aspect Ratio）和配置的安全边距（Padding），动态计算出最佳相机距离 `distance` 和焦点位置 `targetY`，保证无论是 Classic 模型、Slim 模型还是披风展开状态，都能在任何窗口尺寸下完美居中、不超出边界。

* **当前项目现状**：
  PiLauncher 的 `SkinEngine.ts` 使用了硬编码的参数：
  ```typescript
  const CAMERA_POSITION = new THREE.Vector3(0, 1.26, -4.15);
  const CAMERA_TARGET = new THREE.Vector3(0, 0.98, 0);
  const MODEL_SCALE = 0.76;
  ```
  在不同纵横比的布局中（例如侧边栏的窄图或宽大视口），这可能导致玩家头部或足部被裁剪，或者模型显得过小。
* **升级方案**：
  升级 `SkinEngine.ts` 中更新相机的方法，改用包围盒自适应构图算法：
  1. 通过 `THREE.Box3` 计算 `playerWrapper` 整体网格包围盒。
  2. 根据 `camera.aspect` 和视场角（FOV），计算合适的相机 `z` 轴坐标，动态设置 `controls.target`，从而实现高健壮性的自动构图。

---

### 2.4 本地离线 2D 头像渲染（Local Offline 2D Avatar Renderer）

> [!TIP]
> **Modrinth 实现方案**：
> 当需要展示列表中的皮肤头像时，Modrinth 避免了再次渲染昂贵的 3D 场景。
> 它直接通过 HTML5 Canvas 从上传/加载的皮肤 64x64 PNG 中截取头部像素 `(8, 8, 8, 8)` 以及头盔外层像素 `(40, 8, 8, 8)`，并在 Canvas 上合并，最后以 `imageSmoothingEnabled = false` 进行非平滑缩放以保持极致像素风。
> 这个渲染完全在前端纯 JS 执行，并存储于 IndexedDB `head-storage` 中。

* **当前项目现状**：
  PiLauncher 主要依赖 Mojang 的 Minotar 接口 `https://minotar.net/avatar/...`。这导致：
  1. **网络依赖**：没有网络连接时无法显示玩家头像。
  2. **离线皮肤局限**：玩家如果上传了本地离线皮肤，PiLauncher 无法解析并直接生成 2D 像素头像，而是降级为 Steve 默认头像，或者需要依赖 Tauri 调起 Rust 后端函数 `get_or_fetch_account_avatar` 进行网络请求。
* **升级方案**：
  在前端利用 HTML5 Canvas 编写轻量级切图逻辑，对于本地上传的自定义皮肤，直接在浏览器端提取头部像素区域叠加并输出 WebP Blob，提升响应速度和离线可用性。

---

### 2.5 统一渲染底座，剔除 `skinview3d` 依赖

> [!WARNING]
> PiLauncher 目前在主界面及衣柜中使用基于 Three.js 自研的 `SkinEngine.ts` 和 `ThumbnailRenderer.ts`。
> 但在 [DonorSkinModal.tsx](file:///h:/VSCodeWork/pilauncher/src/features/Settings/components/tabs/AS/DonorSkinModal.tsx) 中，却引入了外部 npm 包 **`skinview3d`** 作为渲染库。

* **存在的弊端**：
  1. **包体积冗余**：`skinview3d` 底层同样依赖 Three.js，导致冗余的三维逻辑和第三方打包代码引入。
  2. **视觉不一致**：自研 `SkinEngine` 具有精美定制的圆形渐变聚光灯阴影（`createSpotlightMaterial`），而 `skinview3d` 在 Modal 弹出时没有此阴影效果，导致不同视窗的材质、光照和渲染效果不一致。
* **升级方案**：
  重构 `DonorSkinModal.tsx`，移除 `import { SkinViewer } from 'skinview3d'`，统一使用项目自研的 `SkinEngine` 或直接实例化 `SkinEngine.getOrCreate()`。这不仅可以抹平视觉差异，而且能将 `skinview3d` 从 `package.json` 中彻底移除，精简前端产物体积。

---

## 3. Modrinth 最近更新动态比对（2026年5月）

根据对 Modrinth 源码仓库最新提交记录（**Commit 84b91f32f - fix: skins QA problems + flow change，2026-05-27**）的追踪，Modrinth 最近对皮肤系统进行了一次重大的重构和调整。这些改动对 PiLauncher 具有极高的借鉴价值：

### 3.1 渲染组件逻辑拆分与解耦（Devex: Split up SkinPreviewRenderer）
* **Modrinth 调整**：
  将原本庞大复杂的 `SkinPreviewRenderer.vue` 单文件彻底拆分为了数个职责明确的 **Vue Composables**（Vue 组合式函数）：
  * `useSkinPreviewScene.ts`：负责模型的加载、骨骼深拷贝（使用 `SkeletonUtils.clone` 解决内存泄露）与纹理应用。
  * `useSkinPreviewAnimation.ts`：负责动画混合器（AnimationMixer）的调度、随机待机动画以及点击冲击反馈。
  * `useSkinPreviewControls.ts`：负责鼠标指针捕获与拖拽旋转交互。
  * `useSkinPreviewFit.ts`：负责边界计算（包围盒数学计算）和相机自适应构图。
  * `useSkinPreviewLoading.ts`：负责骨骼/纹理加载完毕后的淡入淡出动画过渡。
* **PiLauncher 借鉴点**：
  PiLauncher 目前的 [SkinEngine.ts](file:///h:/VSCodeWork/pilauncher/src/features/home/engine/SkinEngine.ts) 是一个含有 **770行代码** 的单一庞大类，混杂了 Three.js 初始化、场景渲染、动画过渡调度、鼠标/指针拖拽事件监听、尺寸观察器等职责。
  **建议**：参考 Modrinth 的解耦思路，在 React 中将 `SkinEngine.ts` 内部逻辑解耦为更细粒度的自定义 React Hooks（如 `useSkinScene`、`useSkinAnimation`、`useSkinControls`），以极大提升维护性。

### 3.2 重新恢复点击冲击物理反馈（Re-add Click Impulse from Prototypes）
* **Modrinth 调整**：
  Modrinth 在之前的优化版本中曾临时移除了点击时的物理变形动作。而在最新的提交中，官方**正式重新引入了点击物理冲击（Click Impulse）反馈**，将果冻震颤与伤害闪红（Damage Flash Shader）重新融合，并对点击频率和形变衰减进行了精细化阻尼调节，确保交互体验生动而不失灵敏。

### 3.3 废除“默认披风/披风覆盖”复杂机制，简化 Mojang 接口调用
* **Modrinth 调整**：
  在此前的版本中，Modrinth 在本地 SQLite 和 Mojang 层面设计了复杂的“默认披风”和“自定义皮肤特定披风覆盖（Cape Override）”的多重映射概念。但在最新的 QA 反馈中，该机制不仅增加了本地数据库表结构的维护难度，还导致用户在频繁切换皮肤时向 Mojang 服务端发送大量重复的披风装备请求（导致 HTTP 429 限流问题）。
  Modrinth 移除了 `SelectCapeModal` 独立弹窗，改为在 Skins 主页面展示一列**直观的内联披风列表**，并合并简化了披风装备逻辑。
* **PiLauncher 借鉴点**：
  PiLauncher 在 `AccountSettings` 和 `WebDavManageModal` 中也支持本地保存、多账号披风同步等机制。在涉及与微软/Mojang 交互时，应参考 Modrinth 最新实践，精简状态链路，合并装备网络请求，避免因频繁触发 API 导致账号被 Mojang 限流（HTTP 429）。

---

## 4. 优化实施推荐度矩阵

下表整理了针对 PiLauncher 皮肤与模型模块的优化路线图，以便后续分步实施：

| 优化点 | 影响面 | 实现难度 | 推荐指数 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| **Z-Fighting 深度偏置** | 消除 overlay 穿模像素闪烁，提升渲染正确性 | 🟢 低 (仅需 5 行材质属性配置) | ⭐⭐⭐⭐⭐ | **P0** |
| **移除 `skinview3d`** | 瘦身前端依赖包，统一系统视觉风格 | 🟡 中 (使用 `SkinEngine` 替换 modal 里的渲染) | ⭐⭐⭐⭐⭐ | **P0** |
| **解耦 SkinEngine 结构** | 将 770 行庞大类重构拆分为 React hooks，提升代码质量 | 🔴 高 (结构重构，不涉及交互逻辑) | ⭐⭐⭐⭐ | **P1** |
| **点击反馈与伤害闪红** | 极大地增强交互趣味性，打造高端视觉体验 | 🟡 中 (自定义 shader 混入) | ⭐⭐⭐⭐ | **P1** |
| **自动相机适配 (Auto-Fit)** | 适配任意尺寸视口，保证在复杂 UI 下完美构图 | 🔴 高 (数学包围盒计算与相机映射) | ⭐⭐⭐⭐ | **P1** |
| **本地 2D 头像裁剪** | 增强离线账号体验，摆脱 minotar 网络加载延迟 | 🟡 中 (Canvas 2D 切图叠加) | ⭐⭐⭐ | **P2** |
