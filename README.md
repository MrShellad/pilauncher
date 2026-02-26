# PiLauncher

> A modern, gamepad-friendly Minecraft launcher built with Tauri + React.

PiLauncher 是一款基于 **Tauri + React + TailwindCSS + Framer Motion** 构建的跨平台 Minecraft 启动器，专为 **SteamDeck 及掌机设备** 优化，同时完整支持鼠标、键盘和手柄操作。

目标是提供一个 **轻量、安全、流畅、可扩展** 的现代启动体验。

---

## ✨ Features

### 🎮 Handheld & Gamepad Friendly

* 完整支持手柄操作
* SteamDeck 适配优化
* 专为小屏设备设计的交互布局
* 键盘 / 鼠标 / 手柄统一输入模型

### 🌍 Multi-language Support

* 内置多语言支持
* 可扩展 i18n 架构
* 支持未来社区翻译

### 💾 WebDAV Cloud Backup

* 支持 WebDAV 数据备份
* 实例配置云同步
* 游戏数据安全备份
* 适用于 NAS / 私有云环境

### 🧑‍🚀 3D Player Skin Viewer

* 玩家角色 3D 实时展示
* 支持皮肤渲染
* 支持模型预览（Steve / Alex 等）
* 流畅动画与交互

### 🚀 Cross Platform

* Windows
* Linux
* macOS
* SteamOS / SteamDeck

### 🧩 Instance Management

* 多实例管理
* 模组隔离
* 自定义 JVM 参数
* 版本独立配置

---

## 🛠 Tech Stack

* **Tauri** – Lightweight native wrapper
* **React** – UI framework
* **TailwindCSS** – Utility-first styling
* **Framer Motion** – Fluid animations
* **Rust** – Secure and high-performance backend

---

## 🎯 Design Philosophy

PiLauncher 专注于：

* 极低资源占用
* 掌机设备友好
* 动画流畅
* 结构清晰可扩展
* 不臃肿、不复杂

相比传统 Electron 启动器，PiLauncher 体积更小、内存占用更低、启动更快。

---

## 🖥 SteamDeck Optimization

* 控制器优先交互逻辑
* 适配 1280x800 分辨率
* UI 元素可焦点导航
* 无需外接键鼠即可完整操作

---

## 🔐 Data & Sync

* 支持 WebDAV 服务器连接
* 可对实例数据进行远程备份
* 适用于自建 NAS / 私有云环境
* 用户数据不强制依赖第三方云服务

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/yourname/PiLauncher.git

# Install dependencies
pnpm install

# Run dev mode
pnpm tauri dev
```

---

## 🗺 Roadmap

* [ ] Modpack 自动下载支持
* [ ] 多账号管理优化
* [ ] 插件系统
* [ ] 主题系统
* [ ] 云端实例同步增强
* [ ] 社区皮肤资源浏览

---

## 🤝 Contributing

欢迎 Issue / PR / Feature Request
如果你对掌机优化、Rust 或 UI 设计感兴趣，欢迎参与开发。

---
