# TailwindCSS v3 到 v4 迁移规范与操作指南

本规范文档专门为 AI Agent 及开发人员编写，用于指导将当前项目（`pilauncher`）从 TailwindCSS v3.4 升级迁移至 TailwindCSS v4.3。

---

## 目录结构

- [一、迁移目标与原则](#一迁移目标与原则)
- [二、依赖与配置文件改动规范](#二依赖与配置文件改动规范)
- [三、Theme 主题配置转换字典](#三theme-主题配置转换字典)
- [四、入口与组件 CSS 重构规范](#四入口与组件-css-重构规范)
- [五、逐步执行 Checklist (Agent 操作指南)](#五逐步执行-checklist-agent-操作指南)
- [六、构建验证与回归测试](#六构建验证与回归测试)

---

## 一、迁移目标与原则

1. **零功能/视觉破坏**：迁移后页面的颜色、字体、阴影及尺寸保持 100% 像素级一致。
2. **完整构建通过**：确保 `pnpm run build` (`tsc -b && vite build`) 零报错、无 LightningCSS 警告。
3. **架构现代化**：移出传统 `postcss.config.js` 中的旧版扩展配置，完全转向 `@tailwindcss/vite` 插件及 CSS 原生 `@theme` 定义。

---

## 二、依赖与配置文件改动规范

### 1. `package.json`
- **升级依赖**：
  - `tailwindcss`: `^4.3.3`
  - 新增 devDependency: `@tailwindcss/vite`: `^4.3.3`
- **移除无用依赖**（可选）：`autoprefixer`（Tailwind v4 自带 LightningCSS 前缀处理）。

### 2. `vite.config.ts`
- 引入 `@tailwindcss/vite` 插件：
  ```ts
  import tailwindcss from '@tailwindcss/vite'

  export default defineConfig({
    plugins: [
      tailwindcss(),
      react(),
      // ... 现有其他插件
    ],
  })
  ```

### 3. `postcss.config.js`
- 若项目不再使用其他 PostCSS 插件，可彻底删除 `postcss.config.js`；或清空 `tailwindcss` 节点。

### 4. `tailwind.config.js`
- **废弃并删除该文件**。全部转换定义移至 `src/index.css`。

---

## 三、Theme 主题配置转换字典

在 `src/index.css` 的最顶部添加原生 `@theme` 定义：

```css
@import "tailwindcss";

@theme {
  /* --- 基础主题色 --- */
  --color-ore-green: #3C8527;
  --color-ore-red: #C33636;
  --color-ore-button: #D0D1D4;

  /* --- 导航栏体系 --- */
  --color-ore-nav: #48494A;
  --color-ore-nav-hover: #58585A;
  --color-ore-nav-active: #313233;
  --color-ore-nav-shadow: #242425;

  /* --- 基础边框与轨道 --- */
  --color-ore-gray-border: #1E1E1F;
  --color-ore-gray-track: #8C8D90;

  /* --- 文本颜色 --- */
  --color-ore-text: #F2F2F2;
  --color-ore-text-emphasis: #FFFFFF;
  --color-ore-text-muted: #D0D1D4;
  --color-ore-text-dark: #000000;

  /* --- 自定义阴影 --- */
  --drop-shadow-ore-glow: 0 0 6px var(--ore-focus-glow);

  /* --- 字体系列 --- */
  --font-sans: var(--ore-font-family-sans);
  --font-minecraft: var(--ore-font-family-minecraft);
  --font-jetbrains: "JetBrains Mono", monospace;

  /* --- 间距体系 --- */
  --spacing-ore-nav: 44px;
  --spacing-ore-btn-sm: 36px;
  --spacing-ore-btn-md: 40px;
}
```

---

## 四、入口与组件 CSS 重构规范

### 1. 入口 CSS (`src/index.css`)
- **移除旧指令**：
  ```css
  /* 移除以下 3 行 */
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- **引入新指令及 @theme**（如上文三所示）。

### 2. 需清洗的 26 个组件 CSS 列表
在以下组件 CSS 中，**直接移除**文件顶部的 `@tailwind components;` 或 `@tailwind utilities;` 行，不要保留重复引入：

- `src/style/features/home/MicrosoftAccountSidebar.css`
- `src/style/index.css`
- `src/style/ui/core.css`
- `src/style/ui/layout/SettingsPageLayout.css`
- `src/style/ui/primitives/AccountCard.css`
- `src/style/ui/primitives/BackupListModal.css`
- `src/style/ui/primitives/CreatableCombobox.css`
- `src/style/ui/primitives/DownloadDetailModal.css`
- `src/style/ui/primitives/OreAccordion.css`
- `src/style/ui/primitives/OreButton.css`
- `src/style/ui/primitives/OreCard.css`
- `src/style/ui/primitives/OreCheckbox.css`
- `src/style/ui/primitives/OreDropdown.css`
- `src/style/ui/primitives/OreInput.css`
- `src/style/ui/primitives/OreInstanceCard.css`
- `src/style/ui/primitives/OreOverlayScrollArea.css`
- `src/style/ui/primitives/OreSegmentedControl.css`
- `src/style/ui/primitives/OreSlider.css`
- `src/style/ui/primitives/OreSwitch.css`
- `src/style/ui/primitives/OreTag.css`
- `src/style/ui/primitives/OreToggleButton.css`
- `src/style/ui/primitives/OreTooltip.css`
- `src/style/ui/primitives/SaveRestoreModal.css`

---

## 五、逐步执行 Checklist (Agent 操作指南)

Agent 收到迁移指令时，必须按以下顺序严格执行：

- [ ] **步骤 1：更新依赖**
  - 在 `package.json` 的 `devDependencies` 中升级 `tailwindcss` 到 `^4.3.3` 并添加 `@tailwindcss/vite` (`^4.3.3`)。
  - 执行 `pnpm install`。
- [ ] **步骤 2：配置 Vite 插件**
  - 在 `vite.config.ts` 中 import 并注册 `@tailwindcss/vite`。
- [ ] **步骤 3：迁移主题到 `src/index.css`**
  - 将 `tailwind.config.js` 的映射写入 `src/index.css` 的 `@theme` 中。
  - 删除 `tailwind.config.js` 和 `postcss.config.js`。
- [ ] **步骤 4：批处理清理组件 CSS**
  - 遍历 26 个样式文件，清理冗余的 `@tailwind components;` / `@tailwind utilities;`。
- [ ] **步骤 5：构建与检查**
  - 运行 `pnpm run build` 确保零报错。

---

## 六、构建验证与回归测试

1. **终端指令**：
   ```bash
   pnpm run build
   ```
   *预期输出*：无 LightningCSS Warning，构建输出 bundle 正常。

2. **样式核对**：
   - 检查 `font-minecraft` 字体加载。
   - 检查按钮底色及 hover 色（`bg-ore-nav-hover`, `bg-ore-green`）。
