# 玩家 Skin 功能技术分析

本文分析项目内玩家 skin 功能的技术栈、主要数据流、3D 渲染链路与动画实现。相关功能主要分布在桌面 App 前端、共享 UI 包、共享 Three.js 工具和 Tauri/Rust 后端层。

## 代码范围

- `apps/app-frontend/src/pages/Skins.vue`：skin 页面入口，负责账号状态、skin/cape 列表、选择/删除/上传入口和主预览面板。
- `apps/app-frontend/src/components/ui/skin/*.vue`：上传、编辑、选择 cape 的业务弹窗。
- `apps/app-frontend/src/helpers/skins.ts`：前端 skin/cape 类型定义和 Tauri invoke 封装。
- `apps/app-frontend/src/helpers/rendering/batch-skin-renderer.ts`：离屏批量渲染 skin 卡片预览图和头像。
- `apps/app-frontend/src/helpers/storage/*-storage.ts`：IndexedDB 持久化缓存 skin 预览图和头像。
- `packages/ui/src/components/skin/SkinPreviewRenderer.vue`：实时 3D 玩家预览组件，包含模型加载、纹理应用、交互旋转和动画调度。
- `packages/ui/src/components/skin/SkinButton.vue`、`CapeButton.vue`：skin/cape 列表卡片展示。
- `packages/utils/three/skin-rendering.ts`：共享 Three.js 工具，加载 GLTF/纹理并将 skin/cape 贴图应用到模型材质。
- `packages/assets/models/classic-player.gltf`、`slim-player.gltf`：Classic/Slim 玩家模型与内嵌动画片段。
- `apps/app/src/api/minecraft_skins.rs`：Tauri 插件命令桥接层。
- `packages/app-lib/src/api/minecraft_skins.rs`：skin/cape 业务 API。
- `packages/app-lib/src/api/minecraft_skins/png_util.rs`：PNG 校验、64x32 旧格式升级、透明度修正和 64x64 规范化。
- `packages/app-lib/src/state/minecraft_skins/mod.rs`：本地 SQLite skin/cape 状态读写。
- `packages/app-lib/src/state/minecraft_skins/mojang_api.rs`：Mojang profile skin/cape HTTP API 调用。
- `packages/app-lib/migrations/20250413162050_skin-selector.sql`：本地 skin/cape 表结构。

## 技术栈

前端 UI：

- Vue 3 + Composition API + TypeScript。
- Vite/Tauri 桌面前端，业务页面位于 `apps/app-frontend`。
- 共享 UI 组件位于 `@modrinth/ui`。
- Tailwind CSS utility class + 局部 SCSS。
- `@vueuse/core` 的 `computedAsync` 用于异步派生 skin 贴图 URL。
- Tauri v2 JS API：`@tauri-apps/api/core` 的 `invoke` 调用 Rust 命令，`@tauri-apps/api/webview` 监听拖拽文件。

3D 渲染：

- Three.js `0.172.x`。
- `@tresjs/core`：在 Vue 模板中声明 `TresCanvas`、camera、light、mesh 等 Three.js 对象。
- `@tresjs/cientos`：`useGLTF` 加载 GLTF 玩家模型。
- `@tresjs/post-processing`：`EffectComposerPmndrs` + `FXAAPmndrs` 做抗锯齿后处理。
- 原生 Three.js `WebGLRenderer` 用于离屏批量生成静态预览图。
- 模型资产使用 GLTF，来源是 `classic-player.gltf` 和 `slim-player.gltf`，由 `packages/assets/index.ts` 以 `?url` 形式导出。

本地与服务端交互：

- Tauri plugin 名称为 `minecraft-skins`，命令格式如 `plugin:minecraft-skins|get_available_skins`。
- Rust 侧业务位于 `@modrinth/app-lib`，通过 SQLite 保存自定义 skin 和默认 cape。
- Mojang API 调用使用 `reqwest`：
	- `POST https://api.minecraftservices.com/minecraft/profile/skins` 装备 skin。
	- `DELETE https://api.minecraftservices.com/minecraft/profile/skins/active` 取消自定义 skin。
	- `PUT https://api.minecraftservices.com/minecraft/profile/capes/active` 装备 cape。
	- `DELETE https://api.minecraftservices.com/minecraft/profile/capes/active` 取消 cape。

## 数据模型与来源

前端 `Skin` 类型包含：

- `texture_key`：skin 纹理唯一标识，Rust 侧注释说明其近似纹理 hash。
- `name`：默认 skin 或当前外部 skin 可能带名称。
- `variant`：`CLASSIC`、`SLIM`、`UNKNOWN`。
- `cape_id`：该 skin 指定的 cape 覆盖；为空时使用默认 cape。
- `texture`：PNG URL 或 data URL。
- `source`：`default`、`custom_external`、`custom`。
- `is_equipped`：当前是否已装备。

Rust 返回的 skin 来源分三类：

- 默认 Mojang skin：来自 `packages/app-lib/src/api/minecraft_skins/assets/default/default_skins.rs`。
- 本地自定义 skin：来自 SQLite 表 `custom_minecraft_skins` 和 `custom_minecraft_skin_textures`。
- 外部当前 skin：如果当前装备 skin 不在默认或本地自定义列表中，则追加为 `CustomExternal`，保证前端总能看到当前装备项。

本地数据库表：

- `default_minecraft_capes`：保存每个 Minecraft 用户的默认 cape。
- `custom_minecraft_skins`：保存用户、纹理 key、模型 variant 和 cape 覆盖关系。
- `custom_minecraft_skin_textures`：保存自定义 skin PNG BLOB。

## 主要业务流程

页面加载：

1. `Skins.vue` 并发调用 `get_available_capes()`、`get_available_skins()`、`loadCurrentUser()`。
2. `get_available_skins()` 通过 Tauri invoke 进入 Rust。
3. Rust 侧读取默认账号和在线 Minecraft profile，组合本地自定义 skin、默认 skin 与当前外部 skin。
4. 前端保存 skin/cape 列表，设置当前选中 skin，并调用 `generateSkinPreviews(skins, capes)` 预生成列表缩略图。

装备 skin：

1. 用户点击 `SkinButton`。
2. `Skins.vue` 先乐观更新 `skins.value` 和 `selectedSkin`。
3. 调用 `equip_skin(newSkin)`。
4. Rust 下载或解码 skin 纹理，调用 Mojang skin API 装备，再按 skin 的 `cape_id` 或默认 cape 同步 cape。
5. 如果 Mojang 返回 429，前端回滚乐观状态并显示限流提示。

新增或编辑 skin：

1. `UploadSkinModal.vue` 通过文件选择或 Tauri webview 拖拽获得 PNG。
2. 前端调用 `normalize_skin_texture` 获取标准化后的预览纹理。
3. `EditSkinModal.vue` 通过 `determineModelType()` 判断 Classic/Slim，也允许用户手动选择手臂样式和 cape。
4. 保存时先 `unequip_skin()`，再调用 `add_and_equip_custom_skin(bytes, variant, selectedCape)`。
5. Rust 先校验 PNG 尺寸必须为 64x64 或 64x32，再通过 Mojang API 装备 skin，随后把 Mojang 返回 profile 中的当前 texture key 与原始 PNG 保存到 SQLite。

## 纹理处理

Rust 侧 `png_util.rs` 是权威规范化入口：

- 支持 URL 和 Blob 两类输入。
- 校验 PNG signature 和 IHDR 宽高。
- 只接受 64x64 或 64x32 的 Minecraft skin。
- 将旧版 64x32 skin 扩展为现代 64x64。
- 执行类似 Minecraft 客户端的 legacy skin 处理：
	- 复制并镜像旧版手臂/腿部区域。
	- 对旧版 skin 执行 Notch transparency hack。
	- 将 inner parts 设为不透明。
- 输出 PNG RGBA 64x64，编码时优先速度，适合展示。

前端 `determineModelType()` 使用 Canvas 判断未知模型类型：

- 加载 skin 图片。
- 读取纹理中右臂相关区域 `(54, 20, 2, 12)` 的 alpha。
- 如果该区域存在非透明像素，判断为 `CLASSIC`；否则为 `SLIM`。

渲染用纹理会统一转成 `data:image/png;base64,...`，避免异步渲染组件直接处理 Rust 返回的二进制。

## 实时 3D 预览

实时预览由 `SkinPreviewRenderer.vue` 实现。

场景结构：

- 外层 `TresCanvas` 开启 alpha、antialias、shadow，并设置 `SRGBColorSpace`、`NoToneMapping`。
- 玩家模型在一个 `Group` 中，按 `modelRotation` 绕 Y 轴旋转。
- 使用 `TresPerspectiveCamera`，默认 FOV 40，位置 `[0, 1.5, -3.25]`，look-at 指向模型包围盒中心。
- 光照包含 `TresAmbientLight` 和 `TresDirectionalLight`。
- 脚下阴影不是贴图，而是一个 `TresCircleGeometry` + 自定义 `TresShaderMaterial` 的径向透明 spotlight。
- 可选 nametag 是 DOM 覆盖层，不属于 Three.js 场景。

模型与材质：

- 根据 `variant` 在 `ClassicPlayerModel` 与 `SlimPlayerModel` 间选择 GLTF。
- `useGLTF(src)` 加载模型和动画片段。
- `applyTexture()` 遍历模型 mesh，给非 cape 材质设置 skin 纹理。
- `applyCapeTexture()` 只处理材质名为 `cape` 的材质；无 cape 时使用透明 1x1 CanvasTexture 并隐藏 cape。
- skin/cape 纹理都设置为 sRGB、`flipY=false`、`NearestFilter`，保持 Minecraft 像素风。

加载状态：

- `isModelLoaded` 与 `isTextureLoaded` 同时为真才显示 canvas。
- canvas 使用 `transition-opacity duration-500` 淡入。
- 未 ready 时显示 `Loading...`。

## 动画实现

动画来源：

- 动画片段内嵌在 GLTF 模型中。
- Classic 和 Slim 模型都包含同名动画：
	- `CINEMA_4D_Main`：空通道片段。
	- `idle`：基础待机循环。
	- `idle_sub_1`、`idle_sub_2`、`idle_sub_3`：随机待机变体。
	- `interact`：点击触发交互动画。

动画调度：

- `SkinPreviewRenderer.vue` 创建 `THREE.AnimationMixer(loadedScene)`。
- 每个 `AnimationClip` 通过 `mixer.clipAction(clip)` 转为 `AnimationAction` 并缓存到 `actions`。
- 默认配置：
	- `baseAnimation: 'idle'`
	- `randomAnimations: ['idle_sub_1', 'idle_sub_2', 'idle_sub_3']`
	- `randomAnimationInterval: 8000`
	- `transitionDuration: 0.2`
- `idle` 设置为 `LoopRepeat` 无限循环。
- 随机动画设置为 `LoopOnce`，`clampWhenFinished=true`，播完后回到 `idle`。
- 动画切换使用 `fadeOut()` 和 `fadeIn()` 淡入淡出。
- 使用 `mixer` 的 `finished` 事件监听一次性动画结束，再恢复 base animation。

渲染循环：

- 组件使用 `useRenderLoop()` 注册 `onLoop()`。
- 每一帧调用 `mixer.update(clock.getDelta())` 推进动画时间。
- 这里没有手写 `requestAnimationFrame`，帧循环由 TresJS 管理。

用户交互动画：

- 鼠标或触控拖拽不会触发 GLTF 动画，只更新 `modelRotation`。
- `pointerdown` 记录起始 X 并 capture pointer。
- `pointermove` 用 `deltaX * 0.01` 累加到 Y 轴旋转。
- `pointerup` 释放拖拽。
- 点击 canvas 且没有拖动时，如果存在 `interact` 动画，则调用 `playRandomAnimation('interact')`。

列表卡片动画：

- `SkinButton.vue` 不实时跑 3D，而使用离屏生成的前后两张 WebP。
- hover 时通过 CSS `rotateY(180deg)` 翻转，展示背面图。
- 图片容器使用 `transform-style: preserve-3d`，两张图使用 `backface-visibility: hidden`。
- 加载前显示 skeleton，`@keyframes wave` 做 1500ms 线性 shimmer。
- 覆盖按钮使用 `transition-all` 做 hover 时的位移、缩放和透明度变化。

## 离屏预览与缓存

`batch-skin-renderer.ts` 解决列表中大量 skin 实时 3D 渲染成本过高的问题。

实现方式：

- 使用单例 `BatchSkinRenderer`。
- 创建不可见 canvas 和 `THREE.WebGLRenderer`，尺寸默认 360x504。
- 每个 skin 加载模型与纹理，设置 camera 两个位置：
	- front: `[-1.3, 1, 6.3]`
	- back: `[-1.3, 1, -2.5]`
- 每个视角渲染后调用 `toDataURL('image/webp', 0.9)`，再转为 Blob。
- 结果保存为 `{ forwards, backwards }`。

缓存策略：

- 运行时缓存：
	- `skinBlobUrlMap: reactive(Map<string, RenderResult>)`
	- `headBlobUrlMap: reactive(Map<string, string>)`
- 持久化缓存：
	- `SkinPreviewStorage` 使用 IndexedDB `skin-previews/previews`。
	- `HeadStorage` 使用 IndexedDB `head-storage/heads`。
- skin 预览 key：`${texture_key}+${variant}+${cape_id ?? 'no-cape'}`。
- 头像 key：`${texture_key}-head`。
- 每次生成后会清理不在当前 skin 列表中的无效缓存。

头像生成：

- 不用 3D。
- Canvas 从 skin PNG 取头部基础层 `(8, 8, 8, 8)`。
- 再取帽子层 `(40, 8, 8, 8)`，如果存在非透明像素则叠加。
- 关闭 `imageSmoothingEnabled`，保持像素风。
- 输出 WebP Blob。

## Cape 渲染

Cape 有两种语义：

- 默认 cape：用户没有给某个自定义 skin 指定 cape 时使用。
- skin cape override：某个自定义 skin 显式绑定某个 cape。

前端预览：

- `Skins.vue` 的 `currentCape` 优先使用 `selectedSkin.cape_id` 指向的 cape，否则使用默认 cape。
- `SkinPreviewRenderer` 将 `capeSrc` 应用到 GLTF 中材质名为 `cape` 的 mesh。
- `SelectCapeModal.vue` 支持实时以当前 skin + 当前选择 cape 预览。

Rust 同步：

- `set_default_cape()` 更新 SQLite 默认 cape，并在当前 skin 未设置 cape override 时同步 Mojang 当前 cape。
- `equip_skin()` 装备 skin 后调用 `sync_cape()`，按 skin override 或默认 cape 调整 Mojang 当前 cape。
- `unequip_skin()` 重置 skin 后同样同步默认 cape。

## 关键设计特点

- 实时大预览与列表缩略图分离：大预览使用 TresJS 实时 3D，列表使用离屏 WebP 缓存，性能成本更可控。
- skin 纹理规范化放在 Rust：避免前端重复实现 Minecraft legacy skin 细节，同时对拖拽文件做统一校验。
- 模型动画资产化：动作不是代码里硬编码骨骼变换，而是 GLTF clip，代码只负责调度和过渡。
- 前端采用乐观更新：装备 skin/cape 时 UI 先响应，失败后回滚。
- 缓存分层：Three.js 模型/纹理有内存 cache，skin 卡片和头像还有 IndexedDB 持久缓存。

## 潜在注意点

- `SkinPreviewRenderer` 暴露了 `playAnimation()`、`stopAnimations()`、`getAvailableAnimations()`，但当前页面主要依赖默认 idle/random/interact 调度。
- `CINEMA_4D_Main` 是空通道动画，实际业务动画应使用 `idle`、`idle_sub_*` 和 `interact`。
- `BatchSkinRenderer.clearScene()` 只直接释放顶层 mesh；当前模型在 group 下，复杂资源释放主要依赖共享 cache 的 `disposeCaches()` 和 renderer dispose。若未来批量渲染长期驻留或模型复杂化，需要关注递归释放策略。
- `determineModelType()` 依赖特定像素区域 alpha 判断 Classic/Slim，适用于标准 Minecraft skin 布局；非标准图片仍依赖 Rust 的尺寸和 PNG 校验兜底。
