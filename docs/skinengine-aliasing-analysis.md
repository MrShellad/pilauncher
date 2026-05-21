# SkinEngine 3D 皮肤渲染锯齿问题分析

> 更新时间：2026-05-21
>
> 关联文件：`src/features/home/engine/SkinEngine.ts`、`src/features/home/engine/modrinthSkinRendering.ts`

## 1. 问题描述

皮肤模型在渲染时存在以下视觉问题：

- 静止状态下模型轮廓有明显锯齿（阶梯状边缘）
- 播放动画时边缘像素闪烁、抖动，过渡不平滑
- 外层 overlay（帽子层、外衣层等）的半透明区域边缘尤为明显

## 2. 渲染管线概览

```
GLTF 模型加载
  → cloneModelScene（深拷贝几何/材质）
    → applyPlayerTexture / applyCapeTexture（绑定纹理、配置材质）
      → AnimationMixer（骨骼动画驱动）
        → WebGLRenderer.render()
          → Canvas 输出 + CSS drop-shadow-2xl
```

当前渲染器关键配置一览：

| 配置项 | 当前值 | 文件位置 |
|--------|--------|----------|
| antialias | `true` | `SkinEngine.ts` L220 |
| alpha（透明背景） | `true` | `SkinEngine.ts` L219 |
| pixelRatio | `Math.min(devicePixelRatio, 2)` | `SkinEngine.ts` L224 |
| magFilter / minFilter | `NearestFilter` | `modrinthSkinRendering.ts` L41-42 |
| generateMipmaps | `false` | `modrinthSkinRendering.ts` L43 |
| alphaTest | `0.1` | `modrinthSkinRendering.ts` L83, L113 |
| flatShading | `true` | `modrinthSkinRendering.ts` L79, L109 |
| CSS filter | `drop-shadow-2xl` | `SkinEngine.ts` L208 |

## 3. 根因分析

### 3.1 根因一（主因）：`alphaTest = 0.1` 导致半透明边缘硬切

**严重程度：🔴 高**

**位置**：`modrinthSkinRendering.ts` 第 83 行与第 113 行

```typescript
material.alphaTest = 0.1;
```

**原理**：

`alphaTest` 是一个硬阈值截断机制。在 fragment shader 阶段，像素的 alpha 值低于阈值时执行 `discard`（完全丢弃），高于阈值时视为完全不透明。这意味着不存在中间过渡——边缘要么有、要么没有，形成阶梯状锯齿。

Minecraft 皮肤纹理为 64×64 像素。外层 overlay 部分（帽子、外衣、外裤、外鞋）的许多像素边缘 alpha 值在 0~1 之间存在自然过渡。`alphaTest = 0.1` 把这个平滑过渡一刀切断，产生硬边轮廓。

**不能简单移除 alphaTest 的原因**：

如果完全去掉 `alphaTest`，外层 overlay 中 alpha=0 的不可见像素不会被 discard，它们仍然会写入深度缓冲，干扰内层 base mesh 的渲染，导致 Z-fighting（深度冲突闪烁）。

### 3.2 根因二（关键）：MSAA 对 alphaTest/discard 边缘无效

**严重程度：🔴 高**

**位置**：`SkinEngine.ts` 第 217-221 行

```typescript
this.renderer = new THREE.WebGLRenderer({
  canvas: this._canvas,
  alpha: true,
  antialias: true,
});
```

**原理**：

`antialias: true` 启用浏览器原生 MSAA（Multi-Sample Anti-Aliasing，多重采样抗锯齿）。MSAA 的工作方式是对每个像素取多个子采样点，在**几何体三角形边缘**处混合覆盖率来平滑轮廓。

然而 MSAA 有一个根本性限制：**它只对几何体边缘有效，对 fragment shader 中 `discard` 产生的边缘几乎无效**。

原因是 `discard` 指令在 fragment shader 中执行，此时 MSAA 的覆盖率计算已经完成。被 discard 的 fragment 不参与子采样混合，所以 `alphaTest` 产生的 alpha 边界完全不受 MSAA 保护。

**结论**：当前虽然开启了 `antialias: true`，但锯齿的主要来源（alphaTest 边界）恰好落在 MSAA 的盲区，导致抗锯齿形同虚设。

### 3.3 根因三（次要）：`NearestFilter` 纹理采样加剧运动闪烁

**严重程度：🟡 中（有意为之，属于设计取舍）**

**位置**：`modrinthSkinRendering.ts` 第 41-43 行

```typescript
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
```

**原理**：

`NearestFilter`（最近邻采样）在放大纹理时直接取最近的纹素值，不做双线性插值。对于 Minecraft 的像素风格皮肤，这是业界标准做法（Modrinth、NameMC、skinview3d 均使用 NearestFilter），目的是保持像素的锐利感。

但 NearestFilter 的副作用是：当模型旋转或执行动画时，几何体边缘的纹素在相邻帧之间会发生跳变（因为没有插值平滑），导致边缘像素"闪烁"。禁用 mipmap 进一步加剧了远距离观察时的纹理走样。

**评估**：这不是 bug，而是 Minecraft 社区的视觉惯例。改为 `LinearFilter` 可以平滑边缘，但会让皮肤纹理变得模糊，失去像素风格。**建议保持不变**。

### 3.4 根因四（次要）：`flatShading = true` 导致面法线不连续

**严重程度：🟢 低（语义正确）**

**位置**：`modrinthSkinRendering.ts` 第 79 行与第 109 行

```typescript
material.flatShading = true;
```

**原理**：

`flatShading = true` 让每个三角面使用面法线（face normal）而非顶点法线（vertex normal）。对于 Minecraft 方块人模型，这是正确的——每个面应该接受均匀平整的光照。

副作用是在几何体棱角处（如手臂拐角、头部边缘），相邻面的法线突变导致光照颜色不连续。当 MSAA 试图混合边缘子采样时，法线突变处的颜色差异让抗锯齿效果打折扣。

**评估**：对方块模型而言语义正确，**建议保持不变**。

### 3.5 根因五（中等）：CSS `drop-shadow-2xl` 放大锯齿感知

**严重程度：🟡 中**

**位置**：`SkinEngine.ts` 第 208 行

```typescript
this._canvas.className = 'w-full h-full outline-none pointer-events-auto drop-shadow-2xl';
```

**原理**：

`drop-shadow-2xl` 对应 Tailwind 的 `filter: drop-shadow(0 25px 25px rgb(0 0 0 / 0.15))`。当 WebGL canvas 使用透明背景（`alpha: true`）时，CSS `drop-shadow` 滤镜基于 canvas 输出的 alpha 通道轮廓计算阴影。

两个副效应：

1. **边缘感知放大**：由 alphaTest 硬切产生的锯齿状轮廓被 drop-shadow "描边"，让阶梯状边缘更加醒目。
2. **性能开销**：每帧都需要 GPU 合成器对 canvas 内容做 drop-shadow 卷积运算。在低端设备上可能导致掉帧，间接让动画不流畅。

**评估**：场景内已有一个 spotlight shadow mesh（`SkinEngine.ts` L250-253，使用 ShaderMaterial 的圆形地面阴影），可以增强该效果来替代 CSS drop-shadow。

## 4. 根因关系图

```
                    ┌──────────────────────┐
                    │  视觉表现：模型锯齿   │
                    │  + 运动时边缘闪烁     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼────────┐  ┌───▼──────────┐  ┌──▼─────────────┐
    │ alphaTest = 0.1  │  │ NearestFilter│  │ CSS drop-shadow│
    │ 半透明边缘硬切    │  │ 纹素跳变闪烁  │  │ 锯齿轮廓被描边  │
    └─────────┬────────┘  └──────────────┘  └────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ MSAA 对 discard   │
    │ 边缘无效（盲区）   │
    └───────────────────┘

    根因 1 + 根因 2 形成闭环：alphaTest 产生的锯齿恰好在 MSAA 的覆盖盲区
```

## 5. 修复方案

### 方案 A（推荐）：Alpha-to-Coverage

**原理**：Alpha-to-Coverage（A2C）是 MSAA 的扩展功能。它将 fragment 的 alpha 值转换为 MSAA 覆盖率掩码，使得 alpha 渐变的边缘也能参与多重采样混合，从而平滑 alphaTest 产生的硬切边缘。

**所需改动**：

#### 文件一：`src/features/home/engine/SkinEngine.ts`

在 WebGLRenderer 初始化之后，启用 WebGL 的 `SAMPLE_ALPHA_TO_COVERAGE`：

```typescript
// 现有代码
this.renderer = new THREE.WebGLRenderer({
  canvas: this._canvas,
  alpha: true,
  antialias: true,
});

// 新增：启用 Alpha-to-Coverage
const gl = this.renderer.getContext();
gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
```

#### 文件二：`src/features/home/engine/modrinthSkinRendering.ts`

在 `applyPlayerTexture` 和 `applyCapeTexture` 中修改材质配置：

```typescript
// 替换原有的 alphaTest 设置
material.alphaTest = 0.5;           // A2C 模式下 0.5 是最佳阈值
material.alphaToCoverage = true;    // Three.js r149+ 支持此属性
```

**前置条件**：

- Three.js 版本需 ≥ r149（2023-01 发布），该版本引入了 `Material.alphaToCoverage` 属性
- 浏览器/WebView 需支持 WebGL 的 `SAMPLE_ALPHA_TO_COVERAGE`（主流浏览器和 Tauri WebView2 均支持）
- `antialias: true` 必须开启（当前已开启）

**预期效果**：

- overlay 层边缘从硬切变为平滑渐变
- 运动时边缘闪烁大幅减少
- 不影响像素风格（NearestFilter 保持不变）
- 不影响 base layer 的深度写入正确性

### 方案 B（补充）：区分 Base/Overlay 层的 Alpha 策略

**原理**：Minecraft 皮肤的 GLTF 模型由内层（base：头、身体、四肢）和外层（overlay：帽子层、外衣层等）组成。两层的透明度需求不同：

- Base layer：完全不透明，不需要 alpha 处理
- Overlay layer：部分半透明，需要精细的 alpha 混合

**所需改动**：

在 `applyPlayerTexture` 中根据 mesh 或 material 名称区分层级：

```typescript
function isOverlayMesh(material: THREE.MeshStandardMaterial): boolean {
  // 根据 GLTF 模型中的命名规则判断
  // 需要实际检查模型的 mesh/material name
  const name = material.name.toLowerCase();
  return name.includes('outer') || name.includes('overlay') || name.includes('hat');
}

// Base layer
material.alphaTest = 0.5;
material.transparent = false;
material.depthWrite = true;

// Overlay layer
material.alphaTest = 0;
material.transparent = true;
material.depthWrite = false;  // 避免半透明层干扰深度
material.side = THREE.DoubleSide;
```

**注意**：此方案需要先检查 GLTF 模型中的 mesh/material 命名规则。如果模型没有清晰区分内外层的命名，则需要通过其他方式（如顶点位置偏移量、UV 区域）来判断。

### 方案 C（补充）：移除 CSS drop-shadow

**所需改动**：

在 `SkinEngine.ts` L208 移除 `drop-shadow-2xl`：

```typescript
// 修改前
this._canvas.className = 'w-full h-full outline-none pointer-events-auto drop-shadow-2xl';

// 修改后
this._canvas.className = 'w-full h-full outline-none pointer-events-auto';
```

如需保留阴影效果，可增强已有的场景内 spotlight shadow mesh（L250-253），或在 canvas 外层用独立 DOM 元素做静态阴影。

## 6. 修复优先级

| 优先级 | 方案 | 改动范围 | 预期效果 | 风险 |
|--------|------|----------|----------|------|
| 🔴 P0 | 方案 A：Alpha-to-Coverage | 2 个文件，约 5 行代码 | 从根本解决 MSAA 盲区问题，锯齿感大幅降低 | 需确认 Three.js 版本 ≥ r149 |
| 🟡 P1 | 方案 C：移除 CSS drop-shadow | 1 行代码 | 减少边缘放大效应，提升低端设备帧率 | 需要替代阴影方案 |
| 🟡 P1 | 方案 B：Base/Overlay 分层 | 1 个文件，约 15 行代码 | 外层透明度更精细，配合 A2C 效果更佳 | 需确认模型命名规则 |

**推荐实施顺序**：先实施方案 A（核心修复），验证效果后按需补充方案 C 和 B。

## 7. 不建议修改的配置

| 配置 | 当前值 | 理由 |
|------|--------|------|
| `magFilter` / `minFilter` | `NearestFilter` | Minecraft 社区标准的像素风格，改为 LinearFilter 会导致皮肤纹理模糊 |
| `flatShading` | `true` | 对方块人模型语义正确，每个面应接受均匀光照 |
| `setPixelRatio` | `Math.min(devicePixelRatio, 2)` | 限制最高 2x DPR 是合理的性能保护 |
| `generateMipmaps` | `false` | 配合 NearestFilter 使用，生成 mipmap 无意义 |

## 8. 验证方法

实施修复后，可通过以下方式验证效果：

1. **静态对比**：截取修复前后同一角度的模型截图，放大边缘区域对比锯齿程度
2. **动态对比**：录制修复前后的旋转/动画视频，观察边缘闪烁是否减少
3. **overlay 边缘检查**：选择一个有帽子层的皮肤，观察帽子边缘是否平滑
4. **性能检查**：移除 CSS drop-shadow 后，使用 Chrome DevTools Performance 面板确认帧率是否提升
5. **WebGL 兼容性**：在不同设备/GPU 上测试 Alpha-to-Coverage 是否正常工作

## 9. 参考资料

- [Three.js Material.alphaToCoverage 文档](https://threejs.org/docs/#api/en/materials/Material.alphaToCoverage)
- [WebGL SAMPLE_ALPHA_TO_COVERAGE 规范](https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glEnable.xhtml)
- [Alpha-to-Coverage 抗锯齿原理详解](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f)
- [Modrinth Skin Renderer 源码](https://github.com/modrinth/code/tree/main/packages/app-lib/src/skin)
