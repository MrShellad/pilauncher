// /src/style/tokens/designToken.ts

/**
 * 🎨 OreLauncher Design System Tokens
 * 完美还原 Minecraft Bedrock UI 的色彩与 3D 光影参数
 *
 * Token 命名约定
 * ─────────────────────────────────────────────────────
 * Category  (类别):  color | font | spacing | shadow
 * Property  (属性):  background | border | text | shadow
 * Concept   (概念):  primary | success | warning | danger | neutral | info | surface
 * State     (状态):  default | hover | active | disabled
 *
 * 注入后生成的 CSS 变量遵循：
 *   --ore-{category}-{property}-{concept}-{state}
 * 例：--ore-color-background-primary-hover
 */
export const OreTokens = {

  // ─────────────────────────────────────────────────────────────────────────
  // 🔧 LEGACY — 组件级 token（向后兼容，勿删除）
  // ─────────────────────────────────────────────────────────────────────────
  btn: {
    // 🟩 Primary (主动作 / 绿)
    primary: {
      bg: '#3C8527',
      hover: '#2A641C',
      active: '#1D4D13',
      text: '#FFFFFF',
      shadow: '#1D4D13',
      hl1: 'rgba(255, 255, 255, 0.2)',
      hl2: 'rgba(255, 255, 255, 0.1)',
      hoverHl1: 'rgba(255, 255, 255, 0.4)',
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

  border: {
    color: '#000000', // 统一 2px 纯黑描边
  },

  focus: {
    ring: 'color(display-p3 1 1 1)',
    ringFallback: '#FFFFFF',
    glow: 'rgba(255, 255, 255, 0.6)',
  },

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
      shadow: 'inset 0 4px 8px -2px rgba(0, 0, 0, 0.3)',
    },
    footer: {
      bg: '#313233',
      shadow: 'inset 2px 2px rgba(255, 255, 255, 0.05)',
    },
  },

  downloadDetail: {
    base: '#313233',
    surface: '#48494A',
    divider: '#1E1E1F',
    headerShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.12)',
    sectionShadow: 'inset 0 -4px 0 #313233, inset 2px 2px 0 rgba(255, 255, 255, 0.12)',
    sectionInset: 'inset 0 2px 0 rgba(255, 255, 255, 0.1)',
    listShadow: 'inset 0 10px 20px -10px rgba(0, 0, 0, 0.55)',
    labelText: '#D0D1D4',
    mutedText: '#B1B2B5',
    hintText: '#E6E8EB',
    rowBg: '#D0D1D4',
    rowShadow: 'inset 0 -4px 0 #58585A, inset 2px 2px 0 rgba(255, 255, 255, 0.68)',
    installedBg: 'rgba(108, 195, 73, 0.7)',
    installedShadow: 'inset 0 -4px 0 #3C8527, inset 2px 2px 0 rgba(255, 255, 255, 0.18)',
    idleAccent: '#48494A',
    installedAccent: '#3C8527',
    loaderMeta: '#6B4F00',
    versionMeta: '#24563C',
    imageShadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.25)',
  },

  library: {
    sidebar: {
      panel: {
        bg: '#313233',
        border: '#1E1E1F',
        inset: 'inset 0 2px 0 rgba(255, 255, 255, 0.08)',
      },
      button: {
        bg: '#48494A',
        bgActive: '#67686A',
        border: '#131313',
        borderActive: '#FFFFFF',
        shadow: 'inset -1px -1px #1E1E1F, inset 1px 1px #1E1E1F, inset -2px -2px #313233, inset 2px 2px #6D6D6E',
      },
      section: {
        bg: '#313233',
        border: '#FFFFFF',
        text: '#D0D1D4',
        action: '#B1B2B5',
        actionHover: '#FFFFFF',
        emptyText: '#8C8D90',
        divider: '#58585A',
      },
      tag: {
        bg: '#1E1E1F',
        bgHover: '#58585A',
        bgActive: '#6CC349',
        border: '#000000',
        text: '#FFFFFF',
        textActive: '#000000',
        inputBg: '#313233',
        inputBorder: '#1E1E1F',
        inputPlaceholder: '#B1B2B5',
      },
    },
    card: {
      bg: 'rgba(255, 255, 255, 0.05)',
      bgHover: 'rgba(255, 255, 255, 0.1)',
      border: '#58585A',
      borderHover: '#6D6D6E',
      shadowHover: 'inset 0 -4px 0 rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      mediaBg: '#1E1E1F',
      mediaSize: '56px',
      iconFallback: '#D0D1D4',
      authorText: '#B1B2B5',
      tagBg: 'rgba(0, 0, 0, 0.3)',
      tagText: '#D0D1D4',
      loaderTagBg: 'rgba(60, 133, 39, 0.2)',
      loaderTagText: '#6CC349',
      updateDot: '#F46D6D',
      actionsGradient: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0))',
      metaText: 'rgba(255, 255, 255, 0.3)',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 📐 Spacing
  // Category: spacing
  // 源自 ore-ui.css 中的 margin / padding / gap 规律，基于 2px / 4px 网格
  // ─────────────────────────────────────────────────────────────────────────
  spacing: {
    /** 2px — 极细间距，用于 tag / badge 内边距 */
    xxs: '2px',
    /** 4px — 最小间距，图标偏移、按钮图标右边距 (button_img.left margin-right) */
    xs: '4px',
    /** 6px — 小间距，btn margin、divider margin、checkbox margin、vertical-line */
    sm: '6px',
    /** 8px — 基础间距，modal content padding、block padding、main_block_content margin */
    base: '8px',
    /** 10px — 中等间距，input padding、modal content padding、pop padding 上下、banner padding */
    md: '10px',
    /** 14px — 滑块容器垂直 margin (slider_content) */
    mlg: '14px',
    /** 16px — 较大间距，main_block padding 左右、article list padding */
    lg: '16px',
    /** 20px — 大间距，block_spacing height、page_info margin-left、banner padding */
    xl: '20px',
    /** 24px — 超大间距 */
    xxl: '24px',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🔤 Typography
  // Category: font
  // 源自 ore-ui.css 的字体栈与 font-size 取值
  // ─────────────────────────────────────────────────────────────────────────
  typography: {
    family: {
      /** 正文 / 按钮 / 下拉框 / 输入框 — NotoSans Bold */
      body: '"NotoSans Bold", sans-serif',
      /** 大标题 / 顶栏标题 — Minecraft Ten */
      heading: '"Minecraft Ten", sans-serif',
      /** 副标题 / 文章 / main_title — Minecraft Seven */
      subheading: '"Minecraft Seven", sans-serif',
      /** 装饰细体 — Minecraft Five */
      decorative: '"Minecraft Five", sans-serif',
      /** 装饰粗体 — Minecraft Five Bold */
      decorativeBold: '"Minecraft Five Bold", sans-serif',
    },
    size: {
      /** 12px — tag、page_info */
      xs: '12px',
      /** 14px — hint / dropdown font-size */
      sm: '14px',
      /** 16px — article_note */
      base: '16px',
      /** 17px — link_title、link_block_group_title */
      md: '17px',
      /** 18px — modal_title_area */
      lg: '18px',
      /** 20px — main_detail_center */
      xl: '20px',
      /** 21px — article_title */
      '2xl': '21px',
      /** 24px — main_title_span */
      '3xl': '24px',
      /** 30px — header_title */
      '4xl': '30px',
    },
    lineHeight: {
      /** 紧凑行高，像素标题专用 */
      tight: '1',
      /** 正常行高 */
      normal: '1.4',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 📏 Unit
  // Category: unit
  // 源自 ore-ui.css 中各组件的固定尺寸
  // ─────────────────────────────────────────────────────────────────────────
  unit: {
    /** 标准边框宽度 */
    borderWidth: '2px',
    /** 3D 按钮下沿厚度 (inset bottom shadow) */
    btnDepth: '4px',
    /** 标准交互元素高度：btn / header / modal_title_area / dropdown_label */
    controlHeight: '40px',
    /** 顶栏总高度 */
    headerHeight: '40px',
    /** 页面最小宽度 */
    minPageWidth: '330px',
    /** 侧边栏可见宽度 */
    sidebarWidth: '240px',
    /** 弹窗最大宽度 */
    modalMaxWidth: 'min(600px, 100vw)',
    /** 弹窗最小宽度 */
    modalMinWidth: '320px',
    /** 图标尺寸 — 小 (switch icon, checkbox checkmark) */
    iconSm: '16px',
    /** 图标尺寸 — 中 (modal close btn img) */
    iconMd: '20px',
    /** 图标尺寸 — 大 (header icon, loading icon) */
    iconLg: '32px',
    /** 按钮内联图标宽度 (button_img) */
    btnIconWidth: '14px',
    /** 顶栏按钮宽度 */
    headerItemWidth: '42px',
    /** 侧边栏按钮宽度 */
    sidebarBtnWidth: '140px',
    /** 超小按钮宽度 (.extra_small_btn) */
    btnXs: '100px',
    /** 小按钮宽度 (.small_btn) */
    btnSm: '130px',
    /** 中按钮宽度 (.middle_btn) */
    btnMd: '200px',
    /** 大按钮宽度 (.large_btn) */
    btnLg: '272px',
    /** Switch 开关宽度 */
    switchWidth: '58px',
    /** Switch 开关高度 */
    switchHeight: '24px',
    /** Checkbox 方块尺寸 */
    checkboxSize: '20px',
    /** Slider thumb 尺寸 */
    sliderThumbSize: '28px',
    /** 滚动条主宽度 */
    scrollbarWidth: '22px',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 Semantic Color Tokens
  // Category: color
  // Property→Concept→State 三级语义结构
  // ─────────────────────────────────────────────────────────────────────────
  color: {

    // ── background ──────────────────────────────────────────────────────────
    background: {
      /** 主动作绿色 — .green_btn, .custom-checkbox.on, .slider_process */
      primary: {
        default:  '#3C8527',
        hover:    '#2A641C',
        active:   '#1D4D13',
        disabled: '#D0D1D4',
      },
      /** 成功/在线/已安装 绿色 — .green_badge, .green_tag, .installedBg */
      success: {
        default:  '#6CC349',
        hover:    '#3C8527',
        active:   '#2A641C',
        disabled: '#D0D1D4',
      },
      /** 警告黄色 — .important_banner, .pop.process, .yellow_badge */
      warning: {
        default:  '#FFE866',
        hover:    '#FFE866',
        active:   '#FFE866',
        disabled: '#D0D1D4',
      },
      /** 危险/错误 红色 — .red_btn, .red_badge, .pop.error */
      danger: {
        default:  '#C33636',
        hover:    '#C02D2D',
        active:   '#AD1D1D',
        disabled: '#D0D1D4',
      },
      /** 中性灰色 — .normal_btn, .dropdown_label, .custom-checkbox (off) */
      neutral: {
        default:  '#D0D1D4',
        hover:    '#B1B2B5',
        active:   '#B1B2B5',
        disabled: '#D0D1D4',
      },
      /** 信息蓝色 — .information_banner, article_note */
      info: {
        default:  '#2E6BE5',
        hover:    '#2E6BE5',
        active:   '#2E6BE5',
        disabled: '#D0D1D4',
      },
      /** 深色表面 — modal, input #313233; surface #48494A; sunken #1E1E1F */
      surface: {
        default: '#48494A',  // body / header surface
        raised:  '#313233',  // modal bg / input bg
        sunken:  '#1E1E1F',  // deep divider / dropdown border
        overlay: 'rgba(0, 0, 0, 0.7)', // .overlay
      },
    },

    // ── border ──────────────────────────────────────────────────────────────
    border: {
      /** 主要描边：按钮、输入框、复选框、弹窗 */
      primary: {
        default:  '#1E1E1F',
        hover:    '#1E1E1F',
        active:   '#1E1E1F',
        disabled: '#8C8D90',
      },
      /** 成功状态描边 (checkbox.on) */
      success: {
        default:  '#3C8527',
        hover:    '#2A641C',
        active:   '#1D4D13',
        disabled: '#8C8D90',
      },
      /** 警告状态描边 */
      warning: {
        default:  '#FFE866',
        hover:    '#FFE866',
        active:   '#FFE866',
        disabled: '#8C8D90',
      },
      /** 中性/分割描边：header bottom, divider, link-block */
      neutral: {
        default:  '#B1B2B5',
        subtle:   '#58585A',
        strong:   '#000000',
        disabled: '#8C8D90',
      },
      /** 焦点/选中白描边 (sidebar_btn hover, focus ring) */
      focus: {
        default:  '#FFFFFF',
        disabled: '#8C8D90',
      },
    },

    // ── text ────────────────────────────────────────────────────────────────
    text: {
      /** 主要文字：白色 (modal, main, input normal, pop default) */
      primary: {
        default:  '#FFFFFF',
        hover:    '#FFFFFF',
        active:   '#FFFFFF',
        disabled: '#48494A',
      },
      /** 成功文字 (.pop.success) */
      success: {
        default:  '#6CC349',
        hover:    '#6CC349',
        active:   '#6CC349',
        disabled: '#B1B2B5',
      },
      /** 警告文字 (.pop.process) */
      warning: {
        default:  '#FFE866',
        hover:    '#FFE866',
        active:   '#FFE866',
        disabled: '#B1B2B5',
      },
      /** 危险文字 (.pop.error) */
      danger: {
        default:  '#F46D6D',
        hover:    '#F46D6D',
        active:   '#F46D6D',
        disabled: '#B1B2B5',
      },
      /** 亮底色上的黑色文字 (normal_btn, dropdown_label) */
      onLight: {
        default:  '#000000',
        hover:    '#000000',
        active:   '#000000',
        disabled: '#48494A',
      },
      /** 次要/提示文字 (hint, page_info, mutedText) */
      muted: {
        default:  '#B1B2B5',
        subtle:   'rgba(255, 255, 255, 0.4)',
        strong:   'rgba(255, 255, 255, 0.8)',
        disabled: '#48494A',
      },
      /** 次级标签文字 (link_description, labelText) */
      secondary: {
        default:  '#D0D1D4',
        hover:    '#FFFFFF',
        active:   '#FFFFFF',
        disabled: '#8C8D90',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 💡 Semantic Shadow Tokens
  // Category: shadow
  // Property→Concept→State 结构
  // ─────────────────────────────────────────────────────────────────────────
  shadow: {
    /** 主要 3D 按钮阴影 — .green_btn */
    primary: {
      default:  'inset 0 -4px #1D4D13, inset 3px 3px rgba(255, 255, 255, 0.2), inset -3px -7px rgba(255, 255, 255, 0.1)',
      hover:    'inset 0 -4px #1D4D13, inset 3px 3px rgba(255, 255, 255, 0.4), inset -3px -7px rgba(255, 255, 255, 0.3)',
      active:   'inset 3px 3px rgba(255, 255, 255, 0.4), inset -3px -3px rgba(255, 255, 255, 0.3)',
      disabled: 'inset 0 -4px #B1B2B5',
    },
    /** 中性 3D 按钮阴影 — .normal_btn, .dropdown_label */
    neutral: {
      default:  'inset 0 -4px #58585A, inset 3px 3px rgba(255, 255, 255, 0.6), inset -3px -7px rgba(255, 255, 255, 0.4)',
      hover:    'inset 0 -4px #58585A, inset 3px 3px rgba(255, 255, 255, 0.8), inset -3px -7px rgba(255, 255, 255, 0.6)',
      active:   'inset 3px 3px rgba(255, 255, 255, 0.8), inset -3px -3px rgba(255, 255, 255, 0.6)',
      disabled: 'inset 0 -4px #B1B2B5',
    },
    /** 成功状态 3D 阴影（与 primary 共享来源）*/
    success: {
      default:  'inset 0 -4px #1D4D13, inset 3px 3px rgba(255, 255, 255, 0.2), inset -3px -7px rgba(255, 255, 255, 0.1)',
      hover:    'inset 0 -4px #1D4D13, inset 3px 3px rgba(255, 255, 255, 0.4), inset -3px -7px rgba(255, 255, 255, 0.3)',
      active:   'inset 3px 3px rgba(255, 255, 255, 0.4), inset -3px -3px rgba(255, 255, 255, 0.3)',
      disabled: 'inset 0 -4px #B1B2B5',
    },
    /** 危险 3D 按钮阴影 — .red_btn */
    danger: {
      default:  'inset 0 -4px #AD1D1D, inset 3px 3px rgba(255, 255, 255, 0.2), inset -3px -7px rgba(255, 255, 255, 0.1)',
      hover:    'inset 0 -4px #AD1D1D, inset 3px 3px rgba(255, 255, 255, 0.5), inset -3px -7px rgba(255, 255, 255, 0.4)',
      active:   'inset 3px 3px rgba(255, 255, 255, 0.5), inset -3px -3px rgba(255, 255, 255, 0.4)',
      disabled: 'inset 0 -4px #B1B2B5',
    },
    /** 弹窗整体阴影 */
    modal: {
      default: '0 20px 50px rgba(0, 0, 0, 0.8), inset 2px 2px rgba(255, 255, 255, 0.15), inset -2px -2px rgba(0, 0, 0, 0.25)',
    },
    /** 输入框内凹阴影 — .input */
    input: {
      default:  'inset 0 4px #242425',
      disabled: 'inset 0 4px #B1B2B5',
    },
    /** Checkbox 内高光 */
    checkbox: {
      default:  'inset 2px 2px rgba(255, 255, 255, 0.2), inset -2px -2px rgba(255, 255, 255, 0.1)',
      disabled: 'none',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🔤 Semantic Font Tokens
  // Category: font
  // ─────────────────────────────────────────────────────────────────────────
  font: {
    /** 正文 / 按钮 / 输入框字体 */
    body: '"NotoSans Bold", sans-serif',
    /** 页面主标题 (顶栏) */
    heading: '"Minecraft Ten", sans-serif',
    /** 副标题 / 文章正文 */
    subheading: '"Minecraft Seven", sans-serif',
    /** 装饰用细体 */
    decorative: '"Minecraft Five", sans-serif',
    /** 装饰用粗体 */
    decorativeBold: '"Minecraft Five Bold", sans-serif',
  },

};

// ─────────────────────────────────────────────────────────────────────────────
type DesignTokenPrimitive = string | number | boolean;
type DesignTokenTree = {
  [key: string]: DesignTokenPrimitive | DesignTokenTree;
};

/**
 * 🚀 自动展平注入引擎
 * 将 OreTokens 对象展平为 CSS 变量并注入到 :root。
 * 命名规则：--ore-{a}-{b}-{c}-... (全小驼峰 key 以连字符分隔)
 */
export const injectDesignTokens = (themeObj: DesignTokenTree = OreTokens) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const flattenAndInject = (obj: DesignTokenTree, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        flattenAndInject(value as DesignTokenTree, `${prefix}-${key}`);
      } else {
        root.style.setProperty(`${prefix}-${key}`, String(value));
      }
    }
  };

  flattenAndInject(themeObj, '--ore');
};

// ✅ 自动触发一次注入，确保 CSS 变量在模块加载时即存在
injectDesignTokens();
