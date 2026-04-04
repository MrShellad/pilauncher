const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'src', 'ui', 'i18', 'zh-CN.json');
const enPath = path.join(__dirname, 'src', 'ui', 'i18', 'en-US.json');

const zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const settingsTranslationsZh = {
  "general": {
    "sections": {
      "basic": "基础",
      "window": "窗口与应用",
      "danger": "危险操作"
    },
    "deviceName": {
      "label": "设备名称",
      "description": "用于局域网发现与互联传输时的身份展示标识。",
      "placeholder": "输入设备名称"
    },
    "language": {
      "label": "启动器语言",
      "description": "更改启动器的显示语言。重启后完全生效。"
    },
    "checkUpdate": {
      "label": "检查更新",
      "description": "通过 Tauri 应用内更新检查新版本，并在应用内直接下载与安装。",
      "checking": "检查中...",
      "upToDate": "已是最新版本",
      "error": "检查失败",
      "check": "检查更新"
    },
    "checkUpdateOnStart": {
      "label": "启动时检查更新",
      "description": "每次打开启动器时，主动检查是否存在新的应用版本。"
    },
    "closeBehavior": {
      "label": "关闭按钮行为",
      "description": "点击右上角“X”时执行的操作。当前设置会立即作用到标题栏关闭按钮。"
    },
    "preventTouchAction": {
      "label": "阻止触碰操作",
      "description": "全局禁用网页默认触控行为，如双指缩放、下拉刷新与系统级手势冲突。"
    },
    "toggleFullscreen": {
      "label": "切换全屏",
      "description": "手动进入或退出全屏模式。已加入短暂间隔，避免连续双击导致闪烁。",
      "exit": "退出全屏",
      "enter": "进入全屏"
    },
    "exitApp": {
      "label": "退出应用",
      "description": "关闭 PiLauncher 的当前应用进程。退出前会弹出确认提示。"
    },
    "resetSettings": {
      "label": "恢复默认设置",
      "description": "将启动器的所有设置项重置为初始状态，不会删除实例数据。"
    },
    "exitConfirm": {
      "title": "确认退出",
      "headline": "退出 PiLauncher",
      "description": "确认后会直接退出当前应用。若仍有下载、安装或其他后台任务，它们也会一起停止。",
      "confirm": "确认退出",
      "cancel": "取消"
    },
    "resetConfirm": {
      "title": "恢复默认设置",
      "headline": "确认重置设置",
      "description": "这会恢复启动器设置项，但不会删除实例、存档和下载内容。",
      "confirm": "确认重置",
      "cancel": "取消"
    }
  },
  "java": {
    "sections": {
      "autoDownload": "自动下载获取",
      "environment": "环境配置",
      "memory": "全局内存与参数"
    },
    "autoDownloadDesc": "选择需要的 Java 版本和下载源，点击下载后将自动安装到本地 <code class=\"bg-black/30 px-1 rounded ml-1\">runtime/Java</code> 目录。",
    "targetVersion": "目标 Java 版本",
    "provider": "下载源",
    "btnDownload": "一键下载",
    "downloading": "正在下载...",
    "autoDetect": "自动检测 Java 环境",
    "autoDetectDesc": "开启后会在启动器启动时扫描一次并自动回填版本化 Java 路径。",
    "globalPath": "全局 Java 运行时路径（兜底）",
    "globalPathDesc": "默认 Java 路径。当版本映射关闭或手动设置时可使用。",
    "btnTest": "测试",
    "majorConfig": "版本化全局配置（推荐）",
    "missingAuth": "缺少Java环境",
    "memoryDesc": "默认情况下新建实例会继承这里的内存与参数配置；若实例开启了独立配置，则以实例设置为准。",
    "maxMemory": "全局最大内存分配",
    "maxMemoryDesc": "动态调整游戏可用的最大 RAM。",
    "jvmArgs": "全局 JVM 附加参数",
    "jvmArgsDesc": "高级选项。会应用到继承全局设置的实例。"
  },
  "appearance": {
    "sections": {
      "background": "背景与主题",
      "typography": "排版与特效"
    },
    "btnChangeBg": "更换图片",
    "btnRemoveBg": "移除背景",
    "noBg": "无背景",
    "selectLocalInfo": "点击选择本地图片",
    "bgBlur": "背景模糊度",
    "bgBlurDesc": "调节主界面背景图的模糊效果。",
    "panoramaEnabled": "启用全景背景",
    "panoramaEnabledDesc": "开启后将优先使用 base_path/config/background 下的有效全景图目录。",
    "panoramaSpeed": "全景旋转速度",
    "panoramaSpeedDesc": "控制全景背景自动旋转速度，设为 0 可静止画面。",
    "panoramaDirection": "全景旋转方向",
    "panoramaDirectionDesc": "当前为{{dir}}。",
    "clockwise": "顺时针",
    "counterclockwise": "逆时针",
    "maskColor": "遮罩颜色",
    "maskColorDesc": "覆盖在背景图上方的颜色，用于确保文字可读性。",
    "maskOpacity": "遮罩透明度",
    "maskOpacityDesc": "调节颜色遮罩透明级别，数值越大背景越暗。",
    "fontFamily": "启动器全局字体",
    "fontFamilyDesc": "更改全局界面的主要字体。遇到不支持的字符时，会回退为默认 Minecraft 字体。",
    "maskGradient": "启用底部黑色渐变",
    "maskGradientDesc": "在启动器底部增加一层黑色渐变，提升文字和导航的可读性。"
  },
  "game": {
    "sections": {
      "window": "窗口与渲染",
      "behavior": "启动器行为"
    },
    "windowTitle": "自定义游戏标题",
    "windowTitleDesc": "修改 Minecraft 游戏窗口顶部显示的文字名称。",
    "fullscreen": "全屏模式",
    "fullscreenDesc": "启动游戏后直接进入独占全屏状态。如果你的游戏经常切出导致卡顿，建议关闭此项使用无边框窗口化。",
    "resolution": "启动分辨率",
    "resolutionDesc": "设定游戏初始窗口的大小 (全屏模式下此项仅影响 UI 缩放)。已根据你的显示器自动隐藏不支持的超大分辨率。",
    "showLog": "游戏日志面板",
    "showLogDesc": "启动游戏时展开带有日志输出的控制台面板。关闭后将显示方块跳跃动画，直到游戏加载完成。",
    "visibility": "游戏运行时的可见性",
    "visibilityDesc": "当 Minecraft 实例成功拉起并运行后，主启动器界面的处理方式。"
  },
  "download": {
    "sections": {
      "source": "组件下载源",
      "speed": "速度与并发",
      "faultTolerance": "容错与校验",
      "proxy": "代理服务器",
      "diagnostics": "网络诊断与测试"
    },
    "metaSource": "Minecraft 版本元数据源",
    "metaSourceDesc": "用于获取 version_manifest_v2 版本列表。",
    "autoLatency": "动态测速与自动切换",
    "autoLatencyDesc": "下载前自动对可用节点进行延迟检测，并优先选择低延迟节点。",
    "speedUnit": "速度显示单位",
    "speedUnitDesc": "MB/s 与 Mbps 两种展示模式。",
    "speedLimit": "全局下载限速",
    "speedLimitDesc": "设置为 0 表示不限速。",
    "concurrency": "最大并发任务数",
    "concurrencyDesc": "并发越高速度可能越快，但也会增加网络和系统压力。",
    "chunkedEnable": "单文件分块下载",
    "chunkedEnableDesc": "对支持 Range 的大文件启用多连接下载，提升单文件速度，不影响文件并发数。",
    "chunkedThreads": "分块线程数",
    "chunkedThreadsDesc": "单个文件同时建立的下载连接数量。",
    "chunkedThreshold": "分块阈值",
    "chunkedThresholdDesc": "仅对达到该大小的文件启用分块下载，单位 MB。",
    "timeout": "连接超时",
    "timeoutDesc": "超过该时间未收到服务器响应时自动中断并重试。",
    "retry": "失败重试次数",
    "retryDesc": "单文件下载失败后的自动重试次数。",
    "verifyHash": "下载后校验 (Hash)",
    "verifyHashDesc": "下载完成后执行完整性校验，确保文件未损坏。",
    "proxyMode": "代理模式",
    "proxyModeDesc": "仅影响下载与 API 请求，不影响游戏联机。",
    "proxyHost": "主机地址 (Host)",
    "proxyPort": "端口 (Port)",
    "diagTitle": "网络可用性检测",
    "diagDesc": "测试启动器所需核心域名的连接质量，包括 DNS、TCP、TLS 与 HTTP 层级。",
    "btnDiag": "开始全面诊断",
    "diaging": "正在测试...",
    "systemStatus": "系统与网络状态",
    "scanQr": "扫描上方二维码\\n获取 Base64 诊断报告数据",
    "analyzing": "正在深入抓取网络包并分析连通性...",
    "clickToTest": "点击上方按钮开始测试网络连接状况"
  },
  "account": {
    "sections": {
      "identities": "身份库"
    },
    "btnAddMs": "添加微软正版",
    "btnAddOffline": "添加离线账号",
    "noAccount": "当前未连接任何游戏账户",
    "noMcTip": "尚未拥有 Minecraft 正版授权？通过官方渠道安全获取游戏",
    "buyMc": "Minecraft 官网获取",
    "buyMs": "微软商店 (Windows Store)",
    "delConfirmTitle": "确认移除账号",
    "delConfirmDesc": "确定要移除此账号吗？此操作仅会从启动器中移除该身份，\\n不会删除您的任何本地游戏存档数据。",
    "cancel": "取消操作",
    "confirmDel": "确认移除"
  },
  "data": {
    "sections": {
      "core": "核心数据目录",
      "thirdParty": "导入的实例目录"
    },
    "coreLocation": "核心数据存储位置",
    "currentLoc": "当前位置: {{path}}\\n将游戏实例、日志、启动器配置等核心数据完整迁移至新的目录。",
    "btnModify": "修改目录并迁移",
    "renameDir": "重命名数据文件夹",
    "renameDirDesc": "如果你对当前数据文件夹名字不满意，可以直接对其进行重命名，方便步骤选择或者辨别。",
    "btnRename": "重命名文件夹",
    "cleanLogs": "清理启动器日志",
    "cleanLogsDesc": "清空 logs/ 目录下的全部日志文件，释放磁盘空间。当前路径: {{path}}",
    "btnCleanLogs": "清理日志",
    "removeConfirmTitle": "移除确认",
    "removeConfirmHeadline": "确定要移除此关联目录吗？",
    "removeConfirmDesc1": "此操作将取消与该外部目录的关联，并同步清理 PiLauncher 内对应的实例缓存数据。",
    "removeConfirmDesc2": "原始目录内的文件和存档不会受到任何影响。",
    "btnCancel": "取消",
    "btnRemove": "确认移除",
    "cleanLogsTitle": "清理日志",
    "cleanLogsConfirmTitle": "此操作将删除 logs/ 目录下的所有日志文件，包括游戏启动日志和诊断记录。",
    "cleanLogsConfirmDesc": "清理后不可撤销，建议先导出所需诊断包。当前路径: {{path}}",
    "btnConfirmClean": "确认清理",
    "btnDone": "完成",
    "cleaning": "清理中，请稍候...",
    "cleanSuccess": "清理完成",
    "cleanSuccessDesc": "已成功清理 {{count}} 个日志条目",
    "cleanFailed": "清理失败",
    "renameModalTitle": "重命名目录",
    "renameModalDesc": "修改成功后启动器会自动退出以应用新名称。",
    "renameModalPlaceholder": "新文件夹名字...",
    "btnConfirmRename": "确认重命名",
    "noThirdParty": "暂无导入的外部目录",
    "thirdPartyList": "已关联的第三方文件夹",
    "thirdPartyListDesc1": "这些文件夹内的实例会在启动器启动时被自动扫描。移除关联不会删除本地文件和数据。",
    "thirdPartyListDesc2": "这些外部文件夹内的游戏实例同样会被 PiLauncher 加载。点击移除仅取消关联，不会损伤本地文件。"
  },
  "about": {
    "sections": {
      "product": "产品信息",
      "support": "关注与支持",
      "sponsors": "赞助者"
    },
    "productDesc": "专为掌机与手柄优化的跨平台 Minecraft 启动器。",
    "scanOrA": "扫码或按A键访问",
    "thanks": "感谢所有支持我们的赞助者",
    "thanksDesc": "正是因为有了你们的支持，PiLauncher 才能不断改进与完善。如果你也想支持我们，可以通过上方的爱发电进行赞助。",
    "emptySeat": "虚位以待..."
  }
};

const settingsTranslationsEn = {
  "general": {
    "sections": {
      "basic": "Basic",
      "window": "Window & App",
      "danger": "Danger Zone"
    },
    "deviceName": {
      "label": "Device Name",
      "description": "Identifier used for LAN discovery and file transfer.",
      "placeholder": "Enter device name"
    },
    "language": {
      "label": "Launcher Language",
      "description": "Change the display language. Fully applied after restart."
    },
    "checkUpdate": {
      "label": "Check for Updates",
      "description": "Check for new versions and install updates seamlessly within Tauri.",
      "checking": "Checking...",
      "upToDate": "Up to date",
      "error": "Check failed",
      "check": "Check Update"
    },
    "checkUpdateOnStart": {
      "label": "Check Update on Start",
      "description": "Automatically check for a new version every time you open the launcher."
    },
    "closeBehavior": {
      "label": "Close Button Behavior",
      "description": "Action when clicking the 'X' button."
    },
    "preventTouchAction": {
      "label": "Prevent Touch Action",
      "description": "Disable default web touch behaviors globally."
    },
    "toggleFullscreen": {
      "label": "Toggle Fullscreen",
      "description": "Manually enter or exit fullscreen mode.",
      "exit": "Exit Fullscreen",
      "enter": "Enter Fullscreen"
    },
    "exitApp": {
      "label": "Exit App",
      "description": "Close PiLauncher totally. A prompt will be shown."
    },
    "resetSettings": {
      "label": "Reset Settings",
      "description": "Restore launcher settings to default. Data won't be deleted."
    },
    "exitConfirm": {
      "title": "Confirm Exit",
      "headline": "Exit PiLauncher",
      "description": "Clicking confirm will exit the launcher immediately. Background tasks will stop.",
      "confirm": "Exit Now",
      "cancel": "Cancel"
    },
    "resetConfirm": {
      "title": "Reset Settings",
      "headline": "Confirm Reset",
      "description": "Settings will be reset. Data and instances will be kept.",
      "confirm": "Confirm Reset",
      "cancel": "Cancel"
    }
  },
  "java": {
    "sections": {
      "autoDownload": "Auto Download",
      "environment": "Environment Config",
      "memory": "Global Memory & Args"
    },
    "autoDownloadDesc": "Select version and provider, then download to <code class=\"bg-black/30 px-1 rounded ml-1\">runtime/Java</code> locally.",
    "targetVersion": "Target Java Version",
    "provider": "Provider",
    "btnDownload": "One-click Download",
    "downloading": "Downloading...",
    "autoDetect": "Auto-Detect Java Environment",
    "autoDetectDesc": "If enabled, scans on startup and automatically picks the best versions.",
    "globalPath": "Global Java Runtime (Fallback)",
    "globalPathDesc": "Default Java path used when mapped version isn't available.",
    "btnTest": "Test",
    "majorConfig": "Version-specific Configurations (Recommended)",
    "missingAuth": "Missing Java Environment",
    "memoryDesc": "New instances inherit this global config by default unless customized.",
    "maxMemory": "Global Maximum RAM Allocation",
    "maxMemoryDesc": "Dynamically adjust the maximum RAM for the game.",
    "jvmArgs": "Global Extra JVM Args",
    "jvmArgsDesc": "Advanced level. Applies to instances that inherit settings."
  },
  "appearance": {
    "sections": {
      "background": "Background & Theme",
      "typography": "Typography & Effects"
    },
    "btnChangeBg": "Change Image",
    "btnRemoveBg": "Remove Background",
    "noBg": "No Background",
    "selectLocalInfo": "Click to select a local image",
    "bgBlur": "Background Blur",
    "bgBlurDesc": "Adjust the blur level for the main background image.",
    "panoramaEnabled": "Enable Panorama",
    "panoramaEnabledDesc": "Use effective panorama from base_path/config/background if available.",
    "panoramaSpeed": "Panorama Speed",
    "panoramaSpeedDesc": "Rotation speed for panorama background. Set 0 to pause.",
    "panoramaDirection": "Panorama Direction",
    "panoramaDirectionDesc": "Currently {{dir}}.",
    "clockwise": "Clockwise",
    "counterclockwise": "Counterclockwise",
    "maskColor": "Mask Color",
    "maskColorDesc": "Overlay color on background to ensure text readability.",
    "maskOpacity": "Mask Opacity",
    "maskOpacityDesc": "Overlay opacity. Higher value makes background darker.",
    "fontFamily": "Global Font",
    "fontFamilyDesc": "Main font for launcher. Fallbacks to Minecraft font if not supported.",
    "maskGradient": "Enable Bottom Gradient",
    "maskGradientDesc": "Add a black gradient at bottom to improve text/nav readability."
  },
  "game": {
    "sections": {
      "window": "Window & Render",
      "behavior": "Launcher Behavior"
    },
    "windowTitle": "Custom Window Title",
    "windowTitleDesc": "Text displayed on the Minecraft game window titlebar.",
    "fullscreen": "Fullscreen Mode",
    "fullscreenDesc": "Enter exclusive fullscreen on game start.",
    "resolution": "Launch Resolution",
    "resolutionDesc": "Initial game window size.",
    "showLog": "Game Log Panel",
    "showLogDesc": "Expand console with logs during startup until loading is finished.",
    "visibility": "Visibility during Game Runtime",
    "visibilityDesc": "Action after Minecraft instance is successfully launched."
  },
  "download": {
    "sections": {
      "source": "Component Download Source",
      "speed": "Speed & Concurrency",
      "faultTolerance": "Fault Tolerance & Validation",
      "proxy": "Proxy Server",
      "diagnostics": "Network Diagnostics"
    },
    "metaSource": "Minecraft Metadata Source",
    "metaSourceDesc": "Used to fetch version_manifest_v2.",
    "autoLatency": "Dynamic Auto-Switching",
    "autoLatencyDesc": "Test latency before downloading and pick the lowest one.",
    "speedUnit": "Speed Unit",
    "speedUnitDesc": "Display mode: MB/s or Mbps.",
    "speedLimit": "Global Speed Limit",
    "speedLimitDesc": "0 means unlimited.",
    "concurrency": "Max Concurrent Tasks",
    "concurrencyDesc": "Higher concurrency increases speed but consumes more CPU/RAM.",
    "chunkedEnable": "Chunked Downloading",
    "chunkedEnableDesc": "Use multi-threaded downloads for large files that support Range.",
    "chunkedThreads": "Chunked Threads",
    "chunkedThreadsDesc": "Number of connections per file.",
    "chunkedThreshold": "Chunk Threshold",
    "chunkedThresholdDesc": "Apply chunked downloading for files larger than this (MB).",
    "timeout": "Connection Timeout",
    "timeoutDesc": "Time before automatically interrupting and retrying.",
    "retry": "Max Retries",
    "retryDesc": "Retry attempts when downloading a single file fails.",
    "verifyHash": "Verify After Download (Hash)",
    "verifyHashDesc": "Ensure file was not corrupted after downloaded.",
    "proxyMode": "Proxy Mode",
    "proxyModeDesc": "Affects downloads and APIs only, not game multi-player.",
    "proxyHost": "Proxy Host",
    "proxyPort": "Proxy Port",
    "diagTitle": "Network Connection Diagnostic",
    "diagDesc": "Check core domains accessibility, including DNS, TCP, TLS and HTTP.",
    "btnDiag": "Start Full Diagnostic",
    "diaging": "Testing...",
    "systemStatus": "System & Network Status",
    "scanQr": "Scan QR Code\\nTo get Base64 report",
    "analyzing": "Analyzing packets and connectivity...",
    "clickToTest": "Click the button to test network status"
  },
  "account": {
    "sections": {
      "identities": "Identity Library"
    },
    "btnAddMs": "Add Microsoft Acc",
    "btnAddOffline": "Add Offline Acc",
    "noAccount": "No game accounts connected yet",
    "noMcTip": "Don't own Minecraft? Get it securely from official stores",
    "buyMc": "Get on Minecraft.net",
    "buyMs": "Microsoft Store",
    "delConfirmTitle": "Confirm Removal",
    "delConfirmDesc": "Are you sure? This only removes identity from launcher, \\nwill NOT delete local save data.",
    "cancel": "Cancel",
    "confirmDel": "Confirm Remove"
  },
  "data": {
    "sections": {
      "core": "Core Data Directory",
      "thirdParty": "Imported Instances"
    },
    "coreLocation": "Core Data Location",
    "currentLoc": "Current: {{path}}\\nMigrate all settings, logs, games to a new folder.",
    "btnModify": "Change Folder & Migrate",
    "renameDir": "Rename Data Folder",
    "renameDirDesc": "Rename the current data folder to distinguish it from others.",
    "btnRename": "Rename Folder",
    "cleanLogs": "Clean Launcher Logs",
    "cleanLogsDesc": "Empty all logs from logs/ directory to free space. Currently at: {{path}}",
    "btnCleanLogs": "Clean Logs",
    "removeConfirmTitle": "Confirm Removal",
    "removeConfirmHeadline": "Are you sure to remove this linked dir?",
    "removeConfirmDesc1": "This action unlinks the dir and cleans up related cache in PiLauncher.",
    "removeConfirmDesc2": "Original files will not be touched.",
    "btnCancel": "Cancel",
    "btnRemove": "Remove",
    "cleanLogsTitle": "Clean Logs",
    "cleanLogsConfirmTitle": "This will delete all log files under logs/ directory.",
    "cleanLogsConfirmDesc": "Irreversible. Revert is impossible. Loc: {{path}}",
    "btnConfirmClean": "Confirm Clean",
    "btnDone": "Done",
    "cleaning": "Cleaning...",
    "cleanSuccess": "Success",
    "cleanSuccessDesc": "Cleaned {{count}} log entries.",
    "cleanFailed": "Clean Failed",
    "renameModalTitle": "Rename Directory",
    "renameModalDesc": "Launcher will restart after a successful rename.",
    "renameModalPlaceholder": "New folder name...",
    "btnConfirmRename": "Confirm Rename",
    "noThirdParty": "No external instances found",
    "thirdPartyList": "Linked Third-Party Folders",
    "thirdPartyListDesc1": "Scanned during startup. Removal doesn't delete local data.",
    "thirdPartyListDesc2": "These external folders are managed by PiLauncher too."
  },
  "about": {
    "sections": {
      "product": "Product Information",
      "support": "Support Us",
      "sponsors": "Sponsors"
    },
    "productDesc": "Cross-platform Minecraft Launcher optimized for Gamepad and Handhelds.",
    "scanOrA": "Scan or press A",
    "thanks": "Thanks to all our sponsors",
    "thanksDesc": "Because of your support, PiLauncher can continue to improve. You can sponsor us via AfDian above.",
    "emptySeat": "Awaiting..."
  }
};

zhContent.settings = { ...zhContent.settings, ...settingsTranslationsZh };
enContent.settings = { ...enContent.settings, ...settingsTranslationsEn };

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2), 'utf8');

console.log("JSON written successfully.");
