# 🚀 PiLauncher

> A lightweight, modern Minecraft launcher built with Tauri + React.

PiLauncher 是一个基于 **Tauri + React + TailwindCSS** 构建的跨平台 Minecraft 启动器，
目标是提供一个轻量、可扩展、现代化 UI 体验的启动工具。

---

## ✨ Features

* 🎮 Instance Management
* ⚡ Fast Launch (Rust-powered backend)
* 🎨 Modern Ore-inspired UI
* 📦 Modular Architecture
* 🔄 Extensible Design System
* 🌍 Cross-platform (Windows / macOS / Linux)

---

## 🏗 Tech Stack

**Frontend**

* React
* TypeScript
* TailwindCSS
* React-Facet (state management)

**Backend**

* Tauri
* Rust

---

## 📸 Preview

> (screenshots here later)

```
/docs/screenshots/home.png
/docs/screenshots/instances.png
```

---

## 📦 Installation (Development)

### 1️⃣ Clone repository

```bash
git clone https://github.com/MrShellad/pilauncher.git
cd pilauncher
```

---

### 2️⃣ Install dependencies

```bash
pnpm install
# or
npm install
```

---

### 3️⃣ Run in development

```bash
pnpm tauri dev
```

---

## 🏗 Build

```bash
pnpm tauri build
```

Build output will be located in:

```
src-tauri/target/release/bundle/
```

---

## 📁 Project Structure

```
src/
 ├─ ui/          # Design system components
 ├─ state/       # React-Facet state
 ├─ features/    # Business modules
 ├─ pages/       # Page-level components

src-tauri/
 ├─ src/         # Rust backend
 ├─ tauri.conf.json
```

---

## 🎨 UI Philosophy

PiLauncher follows a restrained, game-oriented design language:

* Dark layered panels
* Low-contrast borders
* Soft glow accents
* Consistent radius & shadow system
* Minimal motion (≤ 200ms transitions)

No over-animation.
No visual noise.
Clarity first.

---

## ⚠ Disclaimer

PiLauncher is an unofficial launcher for Minecraft.

Minecraft is a trademark of Mojang Studios.
This project is not affiliated with or endorsed by Mojang.

---

## 📌 Roadmap

* [ ] Multi-version support
* [ ] Fabric / Forge installer integration
* [ ] Download manager
* [ ] Account management
* [ ] Instance export / import
* [ ] Performance optimization

---

## 🤝 Contributing

Pull requests are welcome.

Before submitting:

* Follow the UI design system
* Avoid introducing third-party UI libraries
* Keep components reusable
* Document new APIs

---

## 📄 License

MIT License


