// /src/style/tokens/designToken.ts

/**
 * 🎨 OreLauncher Design System Tokens
 * 完美还原 Minecraft Bedrock UI 的色彩与 3D 光影参数
 */
export const OreTokens = {
  btn: {
    // 🟩 Primary (主动作 / 绿)
    primary: {
      bg: '#3C8527',
      hover: '#2A641C',
      active: '#1D4D13',
      text: '#FFFFFF',
      shadow: '#1D4D13',
      hl1: 'rgba(255, 255, 255, 0.2)',        // 正常左上高光
      hl2: 'rgba(255, 255, 255, 0.1)',        // 正常右下反光
      hoverHl1: 'rgba(255, 255, 255, 0.4)',   // 悬停高光加剧
      hoverHl2: 'rgba(255, 255, 255, 0.3)',
    },
    // ⬜ Secondary (次要 / 灰)
    secondary: {
      bg: '#D0D1D4',
      hover: '#B1B2B5',
      active: '#B1B2B5',
      text: '#000000',
      shadow: '#58585A',
      hl1: 'rgba(255, 255, 255, 0.6)',
      hl2: 'rgba(255, 255, 255, 0.4)',
      hoverHl1: 'rgba(255, 255, 255, 0.8)',
      hoverHl2: 'rgba(255, 255, 255, 0.6)',
    },
    // 🟥 Danger (危险 / 红)
    danger: {
      bg: '#C33636',
      hover: '#C02D2D',
      active: '#AD1D1D',
      text: '#FFFFFF',
      shadow: '#AD1D1D',
      hl1: 'rgba(255, 255, 255, 0.2)',
      hl2: 'rgba(255, 255, 255, 0.1)',
      hoverHl1: 'rgba(255, 255, 255, 0.5)',
      hoverHl2: 'rgba(255, 255, 255, 0.4)',
    },
    // 🟪 Purple (史诗 / 紫)
    purple: {
      bg: '#9333EA',
      hover: '#A855F7',
      active: '#7E22CE',
      text: '#FFFFFF',
      shadow: '#6B21A8',
      hl1: 'rgba(255, 255, 255, 0.2)',
      hl2: 'rgba(255, 255, 255, 0.1)',
      hoverHl1: 'rgba(255, 255, 255, 0.4)',
      hoverHl2: 'rgba(255, 255, 255, 0.3)',
    },
    // ⬛ Disabled (禁用)
    disabled: {
      bg: '#D0D1D4',
      text: '#48494A',
      border: '#8C8D90',
      shadow: '#B1B2B5',
    },
  },
  // 🌐 核心轮廓系统
  border: {
    color: '#000000', // 统一使用 2px 的纯黑描边
  },
  focus: {
    // 尝试调用 P3 广色域纯白实现物理级 HDR 高亮，降级方案为普通白
    ring: 'color(display-p3 1 1 1)',
    ringFallback: '#FFFFFF',
    glow: 'rgba(255, 255, 255, 0.6)', // 高穿透力外发光
  },
  // 🪟 Modal 弹窗系统 (完美复刻基岩版像素 3D 材质)
  modal: {
    bg: '#313233',
    shadow: '0 20px 50px rgba(0, 0, 0, 0.8), inset 2px 2px rgba(255, 255, 255, 0.15), inset -2px -2px rgba(0, 0, 0, 0.25)',
    header: {
      bg: '#48494A',
      shadow: 'inset 2px 2px rgba(255, 255, 255, 0.2), inset -2px -2px rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
    },
    content: {
      text: '#FFFFFF',
      shadow: 'inset 0 4px 8px -2px rgba(0, 0, 0, 0.3)', // 内容区顶部沉浸阴影
    },
    footer: {
      bg: '#313233',
      shadow: 'inset 2px 2px rgba(255, 255, 255, 0.05)',
    }
  }
};

/**
 * 🚀 自动展平注入引擎
 */
export const injectDesignTokens = (themeObj: Record<string, any> = OreTokens) => {
  // 防御性检查，确保在浏览器环境下运行
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  const flattenAndInject = (obj: Record<string, any>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        flattenAndInject(value, `${prefix}-${key}`);
      } else {
        root.style.setProperty(`${prefix}-${key}`, String(value));
      }
    }
  };

  flattenAndInject(themeObj, '--ore');
};

// ✅ 核心修复：自动触发一次注入，确保 CSS 变量存在！
injectDesignTokens();