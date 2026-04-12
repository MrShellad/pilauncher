// /src/types/settings.ts

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
  deviceName: string;
  deviceId: string;
  preventTouchAction: boolean;
  thirdPartyDirs?: string[];
  lastAgreedLegalDate: string;
  linuxDisableDmabuf: boolean;
}

export interface AppearanceSettings {
  backgroundImage: string | null;
  backgroundBlur: number;
  panoramaEnabled: boolean;
  panoramaRotationSpeed: number;
  panoramaRotationDirection: 'clockwise' | 'counterclockwise';
  maskColor: string;
  maskOpacity: number;
  maskGradient: boolean;
  fontFamily: string;
}

export interface JavaSettings {
  autoDetect: boolean;
  javaPath: string;
  majorJavaPaths: Record<string, string>; // e.g. { "8": "...", "17": "..." }
  maxMemory: number;
  minMemory: number;
  jvmArgs: string;
}

export interface GameSettings {
  windowTitle: string;
  launcherVisibility: 'keep' | 'minimize' | 'close';
  resolution: string;
  fullscreen: boolean;
  gamepadModCheck: boolean; // 手柄启动时自动检测手柄 Mod
  showGameLog: boolean; // 显示游戏日志面板
}

export interface DownloadSettings {
  minecraftMetaSource: 'bangbang93' | 'official';
  // ✅ 核心修改：将原本单一的 source 拆分为四个独立通道
  vanillaSource: string;
  vanillaSourceUrl: string;

  forgeSource: string;
  forgeSourceUrl: string;

  fabricSource: string;
  fabricSourceUrl: string;

  neoforgeSource: string;
  neoforgeSourceUrl: string;

  quiltSource: string;
  quiltSourceUrl: string;

  autoCheckLatency: boolean;
  concurrency: number;
  chunkedDownloadEnabled: boolean;
  chunkedDownloadThreads: number;
  chunkedDownloadMinSizeMb: number;
  speedLimit: number;
  speedUnit: 'MB/s' | 'Mbps';
  retryCount: number;
  timeout: number;
  verifyAfterDownload: boolean;
  proxyType: 'none' | 'http' | 'https' | 'socks5';
  proxyHost: string;
  proxyPort: string;
}

export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  java: JavaSettings;
  game: GameSettings;
  download: DownloadSettings;
}

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
    deviceName: '',
    deviceId: '',
    preventTouchAction: true,
    thirdPartyDirs: [],
    lastAgreedLegalDate: '',
    linuxDisableDmabuf: false,
  } as any,
  appearance: {
    backgroundImage: null,
    backgroundBlur: 8,
    panoramaEnabled: false,
    panoramaRotationSpeed: 0.02,
    panoramaRotationDirection: 'clockwise',
    maskColor: '#000000',
    maskOpacity: 60,
    maskGradient: true,
    fontFamily: 'Minecraft',
  },
  java: {
    autoDetect: true,
    javaPath: '',
    majorJavaPaths: {
      '8': '',
      '11': '',
      '16': '',
      '17': '',
      '21': '',
      '25': ''
    },
    maxMemory: 4096,
    minMemory: 1024,
    jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=50'
  },
  game: {
    windowTitle: 'Minecraft',
    launcherVisibility: 'minimize',
    resolution: '854x480',
    fullscreen: true,
    gamepadModCheck: true,
    showGameLog: true,
  },
  download: {
    minecraftMetaSource: 'bangbang93',
    // ✅ 赋予四个通道初始的默认源 (匹配你的 JSON 数据)
    vanillaSource: 'bmclapi',
    vanillaSourceUrl: 'https://bmclapi2.bangbang93.com',
    forgeSource: 'bmclapi',
    forgeSourceUrl: 'https://bmclapi2.bangbang93.com/forge',
    fabricSource: 'bmclapi',
    fabricSourceUrl: 'https://bmclapi2.bangbang93.com/fabric-meta',
    neoforgeSource: 'bmclapi',
    neoforgeSourceUrl: 'https://bmclapi2.bangbang93.com/neoforge',
    quiltSource: 'official',
    quiltSourceUrl: 'https://meta.quiltmc.org',

    autoCheckLatency: false,
    concurrency: 4,
    chunkedDownloadEnabled: true,
    chunkedDownloadThreads: 4,
    chunkedDownloadMinSizeMb: 32,
    speedLimit: 0,
    speedUnit: 'MB/s',
    retryCount: 5,
    timeout: 15,
    verifyAfterDownload: true,
    proxyType: 'none',
    proxyHost: '127.0.0.1',
    proxyPort: '7890',
  }
};
