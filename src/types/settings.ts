// /src/types/settings.ts

// 1. 定义常规设置的数据结构
export interface GeneralSettings {
  language: string;
  autoUpdate: boolean;
  checkUpdateOnStart: boolean;
  minimizeAfterStart: boolean;
  hideAfterGameStart: boolean;
  closeBehavior: 'tray' | 'exit';
  runOnStartup: boolean;
  keepLogDays: number;
  autoRestartOnCrash: boolean;
  showLogOnFailure: boolean;
  basePath: string;
}

export interface AppearanceSettings {
  backgroundImage: string | null;
  backgroundBlur: number;    // 0 - 50 px
  maskColor: string;         // Hex 颜色值如 #000000
  maskOpacity: number;       // 0 - 100
  maskGradient: boolean;     // 是否启用底部渐变黑影
  fontFamily: string;        // 默认 'Minecraft'
}

export interface JavaSettings {
  autoDetect: boolean;
  javaPath: string;
  maxMemory: number;
  minMemory: number;
  jvmArgs: string;
}

export interface GameSettings {
  // 未来可以在这里添加游戏相关的全局设置
  windowTitle: string;
  launcherVisibility: 'keep' | 'minimize' | 'close';
  resolution: string; // 例如 "1920x1080"
  fullscreen: boolean;
}

export interface DownloadSettings {
  // 未来可以在这里添加下载相关的全局设置
  source: 'official' | 'bmclapi' | 'mcbbs';
  autoCheckLatency: boolean;
  concurrency: number;
  speedLimit: number; // 0 表示不限速，单位 MB/s
  speedUnit: 'MB/s' | 'Mbps';
  retryCount: number;
  timeout: number; // 单位：秒
  verifyAfterDownload: boolean;
  proxyType: 'none' | 'http' | 'https' | 'socks5';
  proxyHost: string;
  proxyPort: string;
}



// 2. 定义全局总配置结构 (后续分类可在此扩展)
export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  java: JavaSettings;
  game: GameSettings;
  download: DownloadSettings;
}

// 3. 集中管理所有设置的“默认出厂值”
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: 'zh-CN',
    autoUpdate: true,
    checkUpdateOnStart: true,
    minimizeAfterStart: false,
    hideAfterGameStart: true,
    closeBehavior: 'tray',
    runOnStartup: false,
    keepLogDays: 30,
    autoRestartOnCrash: true,
    showLogOnFailure: true,
    basePath: '',
  } as any,
  appearance: {
    backgroundImage: null,
    backgroundBlur: 8,
    maskColor: '#000000',
    maskOpacity: 60,
    maskGradient: true,
    fontFamily: 'Minecraft', // 这是我们默认的像素字体
  },
  java: {
    autoDetect: true,
    javaPath: '',
    maxMemory: 4096,
    minMemory: 1024,
    jvmArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions'
  },
  game: {
    windowTitle: 'Minecraft',
    launcherVisibility: 'minimize', // 默认启动后最小化
    resolution: '854x480',          // Minecraft 经典的默认分辨率
    fullscreen: false,
  },
  download: {
    source: 'bmclapi',          // 国内推荐默认使用 BMCLAPI
    autoCheckLatency: true,     // 默认开启测速
    concurrency: 4,            // 默认 32 线程并发
    speedLimit: 0,              // 0 为不限速
    speedUnit: 'MB/s',          // 默认使用主流的 字节/秒
    retryCount: 3,              // 默认重试 3 次
    timeout: 15,                // 15 秒超时
    verifyAfterDownload: true,  // 默认开启哈希校验
    proxyType: 'none',
    proxyHost: '127.0.0.1',
    proxyPort: '7890',
  }
};