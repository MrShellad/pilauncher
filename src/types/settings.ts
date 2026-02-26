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
}

export interface AppearanceSettings {
  backgroundImage: string | null;
  backgroundBlur: number;    // 0 - 50 px
  maskColor: string;         // Hex 颜色值如 #000000
  maskOpacity: number;       // 0 - 100
  maskGradient: boolean;     // 是否启用底部渐变黑影
  fontFamily: string;        // 默认 'Minecraft'
}
// 2. 定义全局总配置结构 (后续分类可在此扩展)
export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  // java: JavaSettings;
  // appearance: AppearanceSettings;
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
  } as any,
  appearance: {
    backgroundImage: null,
    backgroundBlur: 8,
    maskColor: '#000000',
    maskOpacity: 60,
    maskGradient: true,
    fontFamily: 'Minecraft', // 这是我们默认的像素字体
  }
};