# PiLauncher Steam Deck 性能优化分析报告

通过分析当前项目的架构（Tauri + React + Vite + Tailwind + Three.js），针对 Steam Deck（基于 SteamOS 的低功耗 APU 设备），以下是几个关键的性能优化方向：

## 1. 窗口渲染机制优化 (Tauri)
**现状**：`src-tauri/tauri.conf.json` 中配置了 `"transparent": true` 和 `"decorations": false`。
**问题**：在 SteamOS (Linux) 的 Gamescope 合成器下，透明窗口需要额外的合成计算，这会破坏全屏优化（Direct Scanout），极大地消耗 APU 性能，导致启动器 UI 掉帧，并增加耗电。
**建议**：
- 针对 Linux 平台（或提供一个专门的“掌机模式”开关），在运行时或构建时**禁用**窗口透明 (`transparent: false`)。
- 背景直接使用不透明的颜色或背景图填充，可以显著降低 GPU 占用率。

## 2. CSS 高开销滤镜优化 (OreBackground.tsx)
**现状**：`OreBackground.tsx` 及大量 UI 组件中广泛使用了 `filter: blur(...)` 和 `backdrop-filter: blur(...)` (毛玻璃效果)。
**问题**：由于 Steam Deck 的 APU 算力有限，全屏或大面积的动态毛玻璃滤镜是“性能杀手”。当叠加层数过多或配合动画时，会导致严重的渲染延迟和掉帧。
**建议**：
- 在设置中添加“降低图形质量”或“性能模式”选项。
- 当开启性能模式时，全局禁用 `blur` 和 `backdrop-filter`（可以通过给 `body` 挂载特定的 class，如 `.low-graphics`，然后在 CSS 中强制覆盖 `backdrop-filter: none !important; filter: none !important;`）。
- 使用半透明纯色背景（如 `rgba(0,0,0,0.8)`）代替模糊滤镜。

## 3. WebGL 3D 渲染开销控制
**现状**：
- `OreBackground.tsx` 中运行了一个基于 Three.js 的全景 3D 渲染循环 (`requestAnimationFrame`)。
- `SkinEngine.ts` 中运行了另一个皮肤 3D 渲染器 (`setInterval` 30fps)。
**问题**：
- 两个 WebGL 上下文同时运行会持续占据 GPU 资源，在掌机上这会直接导致风扇狂转、发热和电池快速消耗。
- 虽然 `OreBackground` 已经在游戏启动和失去焦点时暂停了渲染，但在正常浏览启动器时它仍在持续消耗性能。
**建议**：
- **静态降级**：允许用户将全景图背景降级为**静态 2D 背景图**，完全卸载 Three.js 场景。
- **动态暂停**：在弹窗打开、路由切换到非主页（如 Mod 管理、设置页面，背景完全被遮挡时），应立即停止 `OreBackground` 的渲染循环。
- **SkinViewer 限制**：当页面滚动导致 3D 皮肤不在视口内（可以使用 `IntersectionObserver`）时，立即暂停 `SkinEngine` 的渲染循环。

## 4. 动画与 CPU 线程阻塞 (Framer Motion)
**现状**：项目使用了 `framer-motion` 实现丰富的交互动画（`OreModal`, `OreDropdown` 等）。
**问题**：过于复杂的 Layout 动画会在主线程（CPU）中进行 JavaScript 计算。Steam Deck 在默认的 15W TDP 限制下，单核性能并不强，密集的 JS 计算可能导致手柄输入反馈（Gamepad Input）出现微小的延迟，影响交互手感。
**建议**：
- 减少 `layout` 属性的过度使用，尽量使用基于 CSS `transform` 和 `opacity` 的动画，这些可以由 GPU 硬件加速。
- 监听系统的 `prefers-reduced-motion`，或者结合前面提到的“性能模式”，大幅缩短动画时间或直接关闭非必要的过渡动画。

## 5. 内存与列表虚拟化
**现状**：项目中 `package.json` 显示已经使用了 `react-virtuoso` 处理长列表（很好）。
**问题**：Mod 列表、实例列表中可能包含大量的图标或图片，如果不做处理，即使 DOM 被虚拟化，浏览器内存中的图片对象也可能暴增。
**建议**：
- 确保虚拟化列表中的图片加载是懒加载的（`<img loading="lazy" />`）。
- 确保获取的网络图片有合适的缩略图尺寸限制，不要加载原始高清图。

## 总结优化路径
1. **最高优先级**：在设置中增加一个 **"Steam Deck / 掌机模式"**。
2. 开启该模式后：
   - 移除背景 `blur`。
   - 关闭 3D 全景背景转为静态大图。
   - 限制或关闭复杂的过渡动画。
   - (若底层支持) 禁用 Tauri 窗口透明度。
