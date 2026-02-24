
# 🎮 PiLauncher

## 基于 Tauri + React + Tailwind + Zustand 的 Ore 风格启动器开发文档

---

# 1. 项目目标

构建一个：

* 模仿 Minecraft 基岩版 Ore UI 风格
* 高性能
* 可长期维护
* 可扩展
* 可发布

的桌面启动器。

---

# 2. 技术栈说明

| 层级   | 技术                |
| ---- | ----------------- |
| 桌面容器 | Tauri             |
| 后端逻辑 | Rust              |
| 前端框架 | React             |
| 样式系统 | TailwindCSS       |
| 状态管理 | Zustand           |
| 动画   | Framer Motion（可选） |

---

# 3. 整体架构设计

```
┌──────────────────────────┐
│         React UI         │
│  (Ore 风格组件体系)       │
└─────────────▲────────────┘
              │
              │ Zustand
              ▼
┌──────────────────────────┐
│       前端状态层          │
└─────────────▲────────────┘
              │
              │ invoke / event
              ▼
┌──────────────────────────┐
│        Rust 后端          │
│  下载 / 启动 / 校验 / IO   │
└──────────────────────────┘
```

核心原则：

* UI 不直接操作系统
* 所有系统行为走 Rust
* 状态统一由 Zustand 管理
* 视觉统一由 Tailwind Token 管理
*动画统一由 Framer Motion Token 管理
---

# 4. 目录结构规范

```
src/
├── App.tsx                 # 入口
│ 
│
├── ui/                   # 纯 UI 组件（无业务）
│   ├── primitives/
│   │   ├── OreCard.tsx
│   │   ├── OreButton.tsx
│   │   ├── OreInput.tsx
│   │   └── OreTabs.tsx
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── MainLayout.tsx
│   │
│   └── tokens.ts
│
├── store/                # Zustand 状态管理
│   ├── useInstanceStore.ts
│   ├── useDownloadStore.ts
│   └── useAppStore.ts
│
├── features/             # 业务模块
│   ├── instances/
│   ├── download/
│   ├── account/
│   └── settings/
│
└── pages/
    ├── Home.tsx
    ├── Instances.tsx
    └── Settings.tsx
```
src/
├── style/
│   ├── global.css                 <-- (刚刚创建)
│   ├── tokens/
│   │   └── motion.ts              <-- (上一轮的 Framer Motion Token)
│   └── ui/
│       └── primitives/
│           └── OreButton.css      <-- (上一轮创建，暂时可以为空)
├── store/
│   └── useLauncherStore.ts        <-- (上一轮的 Zustand 状态)
├── ui/
│   ├── primitives/
│   │   └── OreButton.tsx          <-- (上一轮的按钮组件)
│   └── layout/
│       └── OreBackground.tsx      <-- (上一轮的分层背景组件)
├── pages/
│   └── Home.tsx                   <-- (上一轮的首页页面)
├── App.tsx                        <-- (刚刚更新)
└── main.tsx                       <-- (Vite/React 默认入口，保持原样即可)
---

# 5. Ore 风格视觉系统

---

## 5.1 设计 Token

### tailwind.config.ts

```ts
extend: {
  colors: {
    bg: "#111315",
    panel: "rgba(255,255,255,0.05)",
    borderSoft: "rgba(255,255,255,0.08)",
    accent: "#5ea6ff",
    danger: "#ff5e5e"
  },
  borderRadius: {
    ore: "16px"
  },
  boxShadow: {
    ore: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.45)"
  }
}
```

---

## 5.2 风格规则

允许：

* 半透明层
* 轻边框
* 低对比阴影
* 轻微发光

禁止：

* 强对比高亮
* 大 scale 动画
* 多色渐变乱用
* 拟物风

目标：

> 沉稳、游戏感、科技感、克制

---

# 6. UI 组件设计规范

---

## 6.1 OreCard

用途：内容承载

```tsx
interface OreCardProps {
  children: React.ReactNode
  className?: string
  variant?: "default" | "flat" | "elevated"
}
```

规则：

* 不包含业务逻辑
* 不直接读取 Zustand
* 只负责视觉容器

---

## 6.2 OreButton

```tsx
interface OreButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  loading?: boolean
}
```

行为优先级：

```
disabled > loading > active > hover
```

---

## 6.3 OreInput

```tsx
interface OreInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
}
```

规则：

* 不嵌入验证逻辑
* 错误仅展示

---

# 7. Zustand 状态管理设计

---

## 7.1 实例管理 Store

```ts
import { create } from "zustand"

interface InstanceState {
  instances: Instance[]
  selectedId: string | null
  selectInstance: (id: string) => void
}

export const useInstanceStore = create<InstanceState>((set) => ({
  instances: [],
  selectedId: null,
  selectInstance: (id) => set({ selectedId: id })
}))
```

---

## 7.2 下载管理 Store

```ts
interface DownloadState {
  progress: number
  status: "idle" | "downloading" | "done" | "error"
  setProgress: (v: number) => void
}
```

---

## 7.3 原则

* 每个模块一个 store
* 不要做超大单一 store
* 业务状态放 store
* UI 临时状态用 useState

---

# 8. Tauri 与前端交互规范

---

## 8.1 调用规范

所有系统行为必须通过：

```ts
invoke("command_name", payload)
```

禁止：

* 前端直接访问文件系统
* 前端执行系统命令

---

## 8.2 Rust 负责

* 启动游戏
* 下载文件
* 校验 hash
* 解压
* 资源管理

---

# 9. 页面结构规范

典型结构：

```
Sidebar | Main Content
```

* Sidebar 固定宽度
* Main 可滚动
* 内容全部卡片化

---

# 10. 动画规范

使用 Framer Motion：

允许：

* opacity 过渡
* y 轴 6px
* duration ≤ 200ms

禁止：

* 弹簧动画
* 夸张缓动
* 复杂路径动画

---

# 11. 性能原则

* 列表组件必须 memo
* Zustand 使用 selector
* 大量渲染避免匿名函数
* 不在 render 中创建大对象

---

# 12. 可扩展模块规划

未来可扩展：

* 多账号系统
* Mod 管理
* 资源包管理
* 云同步
* 日志面板
* 性能统计

架构必须支持模块化插拔。

---

# 13. 商标与合规说明

本启动器：

* 不使用 Mojang 官方资源
* 不使用官方 UI 贴图
* 不使用官方字体文件
* 不宣称官方关联

README 必须声明：

```
This project is not affiliated with Mojang Studios.
Minecraft is a trademark of Mojang.
```

---

# 14. 开发优先级路线

阶段一：

* 实例系统
* 基础启动
* UI 设计系统完成

阶段二：

* 下载模块
* 进度系统
* 错误处理

阶段三：

* 多账号
* 优化
* 打包发布

---

# 15. 项目定位

本项目目标：

* 专业级个人作品
* 长期维护
* 结构清晰
* 可扩展
