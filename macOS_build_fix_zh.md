# macOS 平台编译错误修复说明（dispatch2 宏递归超限问题）

当在 GitHub Actions (或其他 macOS 编译机) 上构建 `aarch64-apple-darwin` (Mac 芯片) 版本的 PiLauncher 时，编译流程可能会中断并提示以下错误：

```text
error: recursion limit reached while expanding `$crate::__bitflags_flag_name!`
    --> /Users/runner/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/dispatch2-0.3.1/src/generated/mod.rs:1601:1
     |
1601 | / bitflags::bitflags! {
1602 | |     impl dispatch_block_flags_t: c_ulong {
...
     = help: consider increasing the recursion limit by adding a `#![recursion_limit = "256"]` attribute to your crate (`dispatch2`)
```

---

## 1. 错误原因分析

1. **依赖背景**：`dispatch2` 是 `tao`（Tauri 的底层窗口管理库）以及 `rfd` 等组件在 macOS 平台上的核心依赖，用于封装 Apple 的 Grand Central Dispatch (GCD) 异步调度服务。
2. **宏展开限制**：在较新的 Rust 编译器版本下，`dispatch2` 内部通过 `bitflags!` 宏生成的平台标志代码过于庞大和复杂。展开这些宏所需的递归深度超过了 Rust 编译器默认的安全上限（默认值为 `128`）。
3. **第三方库局限**：因为 `dispatch2` 是来自 crates.io 的第三方只读依赖，我们无法直接在其原始源码中声明 `#![recursion_limit = "256"]`；同时，Rust 编译器也尚未提供能够直接在命令行全局覆盖依赖库递归深度限制的稳定参数。

---

## 2. 解决方案（本地 Patch 机制）

为了在不修改外部 upstream 代码的前提下顺利编译，我们采用了 **Cargo 依赖本地重定向 (Patch) 方案**：

1. **提取源码**：将已下载的 `dispatch2 v0.3.1` 依赖源码完整复制到项目本地目录：
   * 路径：[src-tauri/dispatch2-0.3.1](file:///h:/VSCodeWork/pilauncher/src-tauri/dispatch2-0.3.1/)
2. **注入修改**：在本地副本的根文件 [lib.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/dispatch2-0.3.1/src/lib.rs) 开头注入如下属性，将宏递归深度上限放宽至 `256`：
   ```rust
   #![recursion_limit = "256"]
   ```
3. **接管依赖**：在项目主配置文件 [src-tauri/Cargo.toml](file:///h:/VSCodeWork/pilauncher/src-tauri/Cargo.toml) 中配置 `[patch.crates-io]`，将全局对 `dispatch2` 的调用重定向至本地 Patch 目录：
   ```toml
   [patch.crates-io]
   dispatch2 = { path = "./dispatch2-0.3.1" }
   ```

---

## 3. 验证与后续维护

* **编译验证**：经测试，在添加本地 Patch 后，Tauri 项目在 macOS 环境下调用 `pnpm tauri build` 可成功编译并生成最终的安装包。
* **清理临时文件**：本地 Patch 目录中已清除了 `.cargo-ok` 等临时缓存文件，可以直接提交到 Git 版本控制中。
