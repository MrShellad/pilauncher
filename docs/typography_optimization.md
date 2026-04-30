# 文字锐度与排版优化方案 (Typography Optimization Plan)

针对项目中反馈的文字不够锐利、存在模糊感的问题，在排除像素字体干扰后，整理出以下针对标准矢量字体 (Vector Fonts) 的优化方案。

## 1. 全局渲染引擎优化 (Global CSS)

在 `src/style/global.css` 或 `src/style/index.css` 中注入以下属性，强制浏览器以最高锐度模式渲染。

```css
html, body {
  /* 开启抗锯齿优化，使文字边缘更清晰，减少发虚感 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* 优化文字可读性，强制启用 Kerning 和 Ligatures */
  text-rendering: optimizeLegibility;

  /* 防止文字在动画过程中出现抖动或模糊 */
  -webkit-text-size-adjust: 100%;
}
```

## 2. 避免 GPU 栅格化副作用 (GPU Rendering)

项目中大量使用了 `transform-gpu` 和 `backface-hidden`。
- **问题分析**：这些属性会触发硬件加速，将元素变为位图交给 GPU 处理。如果设备的分辨率（DPI）与位图缩放不匹配，文字会显著变模糊。
- **优化方案**：
  - 仅在需要频繁执行复杂动画（如：平滑缩放、旋转）的元素上使用 `transform-gpu`。
  - 对于**纯文字按钮**或**静态文本框**，应移除 `transform-gpu` 和 `backface-hidden`。
  - 使用 `will-change: transform` 代替强制 GPU 层提升。

## 3. 像素对齐与尺寸优化 (Pixel Alignment)

使用 `rem` 单位在不同 DPI 的屏幕下容易产生 0.5px 的偏置，导致“亚像素模糊”。
- **策略**：
  - 确保根元素 (`html`) 的 `font-size` 为偶数像素（如 16px）。
  - 对于极度追求锐利的小文字（如 Tag、Hint），建议直接使用 `px` 这种物理单位，避免计算带来的精度丢失。
  - 检查容器的 `padding` 和 `margin`。奇数像素的边距有时会导致内部文字在渲染时跨越两个物理像素的边界。

## 4. 字体资源管理 (Font Asset Strategy)

- **字体格式**：优先使用 `woff2` 格式，它拥有更好的压缩率和更现代的渲染指令支持。
- **权重匹配**：
  - 检查 `@import` 的 Google Fonts 链接。确保请求了所有需要的权重（如 400, 500, 700）。
  - 避免让浏览器“模拟”粗体（Synthetic Bold）。如果 CSS 中指定了 `font-weight: 700` 但只加载了 400 权重的字体，浏览器会通过算法加粗，这会非常模糊。
- **本地加载**：如果可能，将字体文件下载并部署在本地，避免网络波动导致的 `font-display` 切换过程中的视觉闪烁。

## 5. 对比度与锐度感知 (Contrast)

锐利感不仅来自渲染，也来自色彩对比。
- **建议**：
  - 在深色背景上，纯白文字 (`#FFFFFF`) 可能会产生明显的“光晕”感。
  - 尝试使用极浅的灰色 (`#F2F2F2` 或 `#E6E8EB`) 代替纯白，可以减少视觉上的边缘溢出。

## 6. 环境适配 (Environment Specifics)

### Windows (Tauri / WebView2)
- **GPU 驱动**：某些集成显卡的驱动程序设置中开启了“平滑字体”或“FXAA”，这会全局模糊所有 Web 程序的文字。
- **CSS 补丁**：在 Windows 平台上，有时设置 `font-weight: 501` (一个非标准值) 可以绕过某些 GDI 渲染的老旧路径，强制使用更现代的 DirectWrite 渲染。

### macOS (WebKit / Safari Engine)
- **灰度渲染**：强制开启 `-moz-osx-font-smoothing: grayscale;`。在 Retina 屏幕上，灰度渲染比亚像素渲染看起来更锐利，且不会有颜色边缘。
- **系统字体适配**：优先使用 `system-ui` 或 `-apple-system`。苹果的系统字体（SF Pro）针对 WebKit 渲染进行了深度优化，锐度极高。
- **避免层叠模糊**：macOS 的 WebKit 引擎在处理多层 `opacity` 或 `blur` 滤镜叠加时，容易导致文字渲染质量下降，应尽量减少文字容器上方的滤镜层。

### Linux (GTK / WebKitGTK / Chromium)
- **微调 (Hinting)**：Linux 下的文字锐度极大程度上取决于系统的 Hinting 设置。建议在 CSS 中使用 `font-variant-ligatures: none;` 以减少某些开源字体在 Linux 下的渲染形状畸变。
- **亚像素排列**：由于 Linux 桌面环境（GNOME/KDE）的亚像素排列顺序（RGB/BGR）各异，建议在全局样式中使用 `image-rendering: -webkit-optimize-contrast;` 来提升整体对比度。
- **字体回退栈**：Linux 系统通常缺少中文字体。建议在 `font-family` 中显式加入 `Noto Sans CJK SC`, `WenQuanYi Micro Hei` 等 Linux 常见的高质量开源字体，防止因回退到点阵字体导致的锯齿感。

