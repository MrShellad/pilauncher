// /src/types/settings.ts

import type { MemoryAllocationMode } from './memory';

export type PerformanceProfile = 'auto' | 'quality' | 'balanced' | 'batterySaver';

export interface WebDavSettings {
  address: string;
  username: string;
  password: string;
  syncFavorites: boolean;
}

export interface GeneralSettings {
  language: string;
  performanceProfile: PerformanceProfile;
  steamDeckLowPowerApplied: boolean;
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
  telemetryUploadEnabled: boolean;
  webDav: WebDavSettings;
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
  customLogo: string | null;
  customLogoScale: number;
  hiddenNavTabs: string[];
  skipExitConfirm: boolean;
}

export interface JavaSettings {
  autoDetect: boolean;
  javaPath: string;
  majorJavaPaths: Record<string, string>; // e.g. { "8": "...", "17": "..." }
  memoryAllocationMode: MemoryAllocationMode;
  maxMemory: number;
  minMemory: number;
  jvmArgs: string;
}

export interface GameSettings {
  windowTitle: string;
  launcherVisibility: 'keep' | 'minimize' | 'close';
  resolution: string;
  fullscreen: boolean;
  steamDeckKeymap: boolean;
  gamepadModCheck: boolean; // 鎵嬫焺鍚姩鏃惰嚜鍔ㄦ娴嬫墜鏌?Mod
  showGameLog: boolean; // 鏄剧ず娓告垙鏃ュ織闈㈡澘
}

export interface DownloadSettings {
  minecraftMetaSource: 'bangbang93' | 'official';
  // 鉁?鏍稿績淇敼锛氬皢鍘熸湰鍗曚竴鐨?source 鎷嗗垎涓哄洓涓嫭绔嬮€氶亾
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
    performanceProfile: 'auto',
    steamDeckLowPowerApplied: false,
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
    telemetryUploadEnabled: true,
    webDav: {
      address: '',
      username: '',
      password: '',
      syncFavorites: true,
    },
    lastAgreedLegalDate: '',
    linuxDisableDmabuf: false,
  },
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
    customLogo: null,
    customLogoScale: 100,
    hiddenNavTabs: [],
    skipExitConfirm: false,
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
    memoryAllocationMode: 'auto',
    maxMemory: 4096,
    minMemory: 1024,
    jvmArgs: '-XX:+UseZGC -XX:+UnlockExperimentalVMOptions -XX:+ZGenerational -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=150 -XX:G1NewSizePercent=30 -XX:G1ReservePercent=20'
  },
  game: {
    windowTitle: 'Minecraft',
    launcherVisibility: 'minimize',
    resolution: '854x480',
    fullscreen: true,
    steamDeckKeymap: false,
    gamepadModCheck: true,
    showGameLog: true,
  },
  download: {
    minecraftMetaSource: 'bangbang93',
    // 鉁?璧嬩簣鍥涗釜閫氶亾鍒濆鐨勯粯璁ゆ簮 (鍖归厤浣犵殑 JSON 鏁版嵁)
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
    concurrency: 8,
    chunkedDownloadEnabled: true,
    chunkedDownloadThreads: 2,
    chunkedDownloadMinSizeMb: 8,
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

