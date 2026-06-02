import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, AlertTriangle, Search, Keyboard, RotateCw, CheckCircle2 } from 'lucide-react';

import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { useToastStore } from '../../../../store/useToastStore';

// @ts-ignore
import keyboardLayoutJson from '../../../../assets/keyboard/keyboard-layout.json';
// @ts-ignore
import keyboardLayoutSvg from '../../../../assets/keyboard/keyboard-layout.svg?raw';

// standard keybind name map
const STANDARD_KEYBINDS: Record<string, { zh: string; en: string }> = {
  "key.forward": { zh: "向前移动", en: "Move Forward" },
  "key.left": { zh: "向左移动", en: "Move Left" },
  "key.back": { zh: "向后移动", en: "Move Backward" },
  "key.right": { zh: "向右移动", en: "Move Right" },
  "key.jump": { zh: "跳跃", en: "Jump" },
  "key.sneak": { zh: "潜行", en: "Sneak" },
  "key.sprint": { zh: "疾跑", en: "Sprint" },
  "key.drop": { zh: "丢弃物品", en: "Drop Item" },
  "key.inventory": { zh: "打开/关闭背包", en: "Open/Close Inventory" },
  "key.chat": { zh: "打开聊天栏", en: "Open Chat" },
  "key.playerlist": { zh: "显示玩家列表", en: "List Players" },
  "key.screenshot": { zh: "截图", en: "Take Screenshot" },
  "key.togglePerspective": { zh: "切换视角", en: "Toggle Perspective" },
  "key.smoothCamera": { zh: "电影级摄像机", en: "Cinematic Camera" },
  "key.swapHands": { zh: "副手物品交换", en: "Swap Item In Hands" },
  "key.use": { zh: "使用物品/放置方块", en: "Use Item/Place Block" },
  "key.attack": { zh: "攻击/毁坏", en: "Attack/Destroy" },
  "key.pickItem": { zh: "选取方块", en: "Pick Block" },
  "key.fullscreen": { zh: "切换全屏", en: "Toggle Fullscreen" },
  "key.spectatorOutlines": { zh: "高亮显示玩家 (旁观)", en: "Highlight Players (Spectator)" },
  "key.hotbar.1": { zh: "快捷栏第1格", en: "Hotbar Slot 1" },
  "key.hotbar.2": { zh: "快捷栏第2格", en: "Hotbar Slot 2" },
  "key.hotbar.3": { zh: "快捷栏第3格", en: "Hotbar Slot 3" },
  "key.hotbar.4": { zh: "快捷栏第4格", en: "Hotbar Slot 4" },
  "key.hotbar.5": { zh: "快捷栏第5格", en: "Hotbar Slot 5" },
  "key.hotbar.6": { zh: "快捷栏第6格", en: "Hotbar Slot 6" },
  "key.hotbar.7": { zh: "快捷栏第7格", en: "Hotbar Slot 7" },
  "key.hotbar.8": { zh: "快捷栏第8格", en: "Hotbar Slot 8" },
  "key.hotbar.9": { zh: "快捷栏第9格", en: "Hotbar Slot 9" },
  "key.saveToolbarActivator": { zh: "保存快捷栏激活键", en: "Save Toolbar Activator" },
  "key.loadToolbarActivator": { zh: "加载快捷栏激活键", en: "Load Toolbar Activator" },
  "key.advancements": { zh: "打开进度界面", en: "Advancements" },
  "key.command": { zh: "打开命令栏", en: "Open Command" },
  "key.socialInteractions": { zh: "多人联机社交交互", en: "Social Interactions Screen" },
};

const FRIENDLY_KEYS: Record<string, { zh: string; en: string }> = {
  "key.mouse.left": { zh: "鼠标左键", en: "Left Click" },
  "key.mouse.right": { zh: "鼠标右键", en: "Right Click" },
  "key.mouse.middle": { zh: "鼠标中键", en: "Middle Click" },
  "key.keyboard.space": { zh: "空格键", en: "Space" },
  "key.keyboard.left.shift": { zh: "左 Shift", en: "LShift" },
  "key.keyboard.right.shift": { zh: "右 Shift", en: "RShift" },
  "key.keyboard.left.control": { zh: "左 Ctrl", en: "LCtrl" },
  "key.keyboard.right.control": { zh: "右 Ctrl", en: "RCtrl" },
  "key.keyboard.left.alt": { zh: "左 Alt", en: "LAlt" },
  "key.keyboard.right.alt": { zh: "右 Alt", en: "RAlt" },
  "key.keyboard.escape": { zh: "Esc", en: "Esc" },
  "key.keyboard.enter": { zh: "回车键", en: "Enter" },
  "key.keyboard.tab": { zh: "Tab 键", en: "Tab" },
  "key.keyboard.backspace": { zh: "退格键", en: "Backspace" },
  "key.keyboard.caps.lock": { zh: "大写锁定", en: "Caps Lock" },
  "key.keyboard.num.lock": { zh: "数字锁定", en: "Num Lock" },
  "key.keyboard.scroll.lock": { zh: "滚动锁定", en: "Scroll Lock" },
  "key.keyboard.up": { zh: "方向键上", en: "Up Arrow" },
  "key.keyboard.down": { zh: "方向键下", en: "Down Arrow" },
  "key.keyboard.left": { zh: "方向键左", en: "Left Arrow" },
  "key.keyboard.right": { zh: "方向键右", en: "Right Arrow" },
};

const LWJGL_KEYS: Record<string, string> = {
  "1": "Esc", "2": "1", "3": "2", "4": "3", "5": "4", "6": "5", "7": "6", "8": "7", "9": "8", "10": "9", "11": "0",
  "12": "-", "13": "=", "14": "Backspace", "15": "Tab", "16": "Q", "17": "W", "18": "E", "19": "R", "20": "T", "21": "Y",
  "22": "U", "23": "I", "24": "O", "25": "P", "26": "[", "27": "]", "28": "Enter", "29": "LCtrl", "30": "A", "31": "S",
  "32": "D", "33": "F", "34": "G", "35": "H", "36": "J", "37": "K", "38": "L", "39": ";", "40": "'", "41": "`",
  "42": "LShift", "43": "\\", "44": "Z", "45": "X", "46": "C", "47": "V", "48": "B", "49": "N", "50": "M", "51": ",",
  "52": ".", "53": "/", "54": "RShift", "56": "LAlt", "57": "Space", "58": "Caps Lock",
  "200": "Up", "203": "Left", "205": "Right", "208": "Down",
};

const INDEX_TO_MC_KEY = [
  // Row 1 (16 keys)
  "key.keyboard.escape",
  "key.keyboard.f1",
  "key.keyboard.f2",
  "key.keyboard.f3",
  "key.keyboard.f4",
  "key.keyboard.f5",
  "key.keyboard.f6",
  "key.keyboard.f7",
  "key.keyboard.f8",
  "key.keyboard.f9",
  "key.keyboard.f10",
  "key.keyboard.f11",
  "key.keyboard.f12",
  "key.keyboard.print.screen",
  "key.keyboard.scroll.lock",
  "key.keyboard.pause",

  // Row 2 (21 keys)
  "key.keyboard.grave.accent",
  "key.keyboard.1",
  "key.keyboard.2",
  "key.keyboard.3",
  "key.keyboard.4",
  "key.keyboard.5",
  "key.keyboard.6",
  "key.keyboard.7",
  "key.keyboard.8",
  "key.keyboard.9",
  "key.keyboard.0",
  "key.keyboard.minus",
  "key.keyboard.equal",
  "key.keyboard.backspace",
  "key.keyboard.insert",
  "key.keyboard.home",
  "key.keyboard.page.up",
  "key.keyboard.num.lock",
  "key.keyboard.keypad.divide",
  "key.keyboard.keypad.multiply",
  "key.keyboard.keypad.subtract",

  // Row 3 (21 keys)
  "key.keyboard.tab",
  "key.keyboard.q",
  "key.keyboard.w",
  "key.keyboard.e",
  "key.keyboard.r",
  "key.keyboard.t",
  "key.keyboard.y",
  "key.keyboard.u",
  "key.keyboard.i",
  "key.keyboard.o",
  "key.keyboard.p",
  "key.keyboard.left.bracket",
  "key.keyboard.right.bracket",
  "key.keyboard.backslash",
  "key.keyboard.delete",
  "key.keyboard.end",
  "key.keyboard.page.down",
  "key.keyboard.keypad.7",
  "key.keyboard.keypad.8",
  "key.keyboard.keypad.9",
  "key.keyboard.keypad.add",

  // Row 4 (16 keys)
  "key.keyboard.caps.lock",
  "key.keyboard.a",
  "key.keyboard.s",
  "key.keyboard.d",
  "key.keyboard.f",
  "key.keyboard.g",
  "key.keyboard.h",
  "key.keyboard.j",
  "key.keyboard.k",
  "key.keyboard.l",
  "key.keyboard.semicolon",
  "key.keyboard.apostrophe",
  "key.keyboard.enter",
  "key.keyboard.keypad.4",
  "key.keyboard.keypad.5",
  "key.keyboard.keypad.6",

  // Row 5 (17 keys)
  "key.keyboard.left.shift",
  "key.keyboard.z",
  "key.keyboard.x",
  "key.keyboard.c",
  "key.keyboard.v",
  "key.keyboard.b",
  "key.keyboard.n",
  "key.keyboard.m",
  "key.keyboard.comma",
  "key.keyboard.period",
  "key.keyboard.slash",
  "key.keyboard.right.shift",
  "key.keyboard.up",
  "key.keyboard.keypad.1",
  "key.keyboard.keypad.2",
  "key.keyboard.keypad.3",
  "key.keyboard.keypad.enter",

  // Row 6 (13 keys)
  "key.keyboard.left.control",
  "key.keyboard.left.win",
  "key.keyboard.left.alt",
  "key.keyboard.space",
  "key.keyboard.right.alt",
  "key.keyboard.right.win",
  "key.keyboard.menu",
  "key.keyboard.right.control",
  "key.keyboard.left",
  "key.keyboard.down",
  "key.keyboard.right",
  "key.keyboard.keypad.0",
  "key.keyboard.keypad.decimal"
];

interface KeyBind {
  name: string;
  key: string;
}

interface KeymapSectionProps {
  instanceId: string;
}

type SortField = 'name' | 'key' | 'status';
type SortOrder = 'asc' | 'desc';

const mapEventCodeToMcKey = (code: string): string => {
  if (code.startsWith("Key")) {
    return `key.keyboard.${code.substring(3).toLowerCase()}`;
  }
  if (code.startsWith("Digit")) {
    return `key.keyboard.${code.substring(5)}`;
  }
  if (code.startsWith("Numpad") && code.length === 7) {
    return `key.keyboard.keypad.${code.substring(6)}`;
  }
  switch (code) {
    case "Space": return "key.keyboard.space";
    case "ShiftLeft": return "key.keyboard.left.shift";
    case "ShiftRight": return "key.keyboard.right.shift";
    case "ControlLeft": return "key.keyboard.left.control";
    case "ControlRight": return "key.keyboard.right.control";
    case "AltLeft": return "key.keyboard.left.alt";
    case "AltRight": return "key.keyboard.right.alt";
    case "Escape": return "key.keyboard.escape";
    case "Enter": return "key.keyboard.enter";
    case "Tab": return "key.keyboard.tab";
    case "Backspace": return "key.keyboard.backspace";
    case "CapsLock": return "key.keyboard.caps.lock";
    case "ArrowUp": return "key.keyboard.up";
    case "ArrowDown": return "key.keyboard.down";
    case "ArrowLeft": return "key.keyboard.left";
    case "ArrowRight": return "key.keyboard.right";
    case "F1": return "key.keyboard.f1";
    case "F2": return "key.keyboard.f2";
    case "F3": return "key.keyboard.f3";
    case "F4": return "key.keyboard.f4";
    case "F5": return "key.keyboard.f5";
    case "F6": return "key.keyboard.f6";
    case "F7": return "key.keyboard.f7";
    case "F8": return "key.keyboard.f8";
    case "F9": return "key.keyboard.f9";
    case "F10": return "key.keyboard.f10";
    case "F11": return "key.keyboard.f11";
    case "F12": return "key.keyboard.f12";
    default:
      return `key.keyboard.${code.toLowerCase()}`;
  }
};

export const KeymapSection: React.FC<KeymapSectionProps> = ({ instanceId }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const addToast = useToastStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [keybindings, setKeybindings] = useState<KeyBind[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Edit State
  const [editingBind, setEditingBind] = useState<KeyBind | null>(null);

  // Selected Key Filter State
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<string | null>(null);

  interface KeyboardLocData {
    metadata: {
      authors: string[];
      createdAt: string;
      updatedAt: string;
      version: string;
    };
    keys: Record<string, string>;
    actions: Record<string, string>;
  }

  const [keyboardLoc, setKeyboardLoc] = useState<KeyboardLocData | null>(null);
  const [locLang, setLocLang] = useState<string>('');

  useEffect(() => {
    const loadLocalization = async () => {
      try {
        const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
        const data = await invoke<KeyboardLocData>('get_keyboard_localization', { lang });
        setKeyboardLoc(data);
        setLocLang(lang);
      } catch (err) {
        console.error('加载按键本地化失败:', err);
      }
    };
    void loadLocalization();
  }, [i18n.language]);

  // Keyboard hover states
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [hoveredEl, setHoveredEl] = useState<Element | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // Update tooltip position relative to container
  useEffect(() => {
    if (!hoveredEl) return;
    const container = hoveredEl.closest('.keyboard-preview-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = hoveredEl.getBoundingClientRect();
    
    // Fixed tooltip width is 288px (18rem)
    const tooltipWidth = 288;
    const halfWidth = tooltipWidth / 2;
    
    // Calculate center top of the hovered keycap relative to container
    let left = elRect.left - containerRect.left + elRect.width / 2;
    const top = elRect.top - containerRect.top - 8;
    
    // Clamp left position so the tooltip stays inside the container boundaries (with 8px safety margin)
    const minLeft = halfWidth + 8;
    const maxLeft = containerRect.width - halfWidth - 8;
    left = Math.max(minLeft, Math.min(maxLeft, left));
    
    setTooltipPos({ top, left });
  }, [hoveredEl]);

  // Parse Keycaps Data from SVG & JSON
  interface KeycapData {
    index: number;
    outer: { x: number; y: number; w: number; h: number; rx: number };
    inner: { x: number; y: number; w: number; h: number; rx: number };
    label: string;
    keyCode: string;
  }

  const keycaps = useMemo<KeycapData[]>(() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(keyboardLayoutSvg, 'image/svg+xml');
      const keycapGroups = doc.querySelectorAll('.keycap');
      
      const labels: string[] = [];
      for (const row of keyboardLayoutJson as any) {
        for (const item of row) {
          if (typeof item === 'string') {
            labels.push(item);
          }
        }
      }
      
      return Array.from(keycapGroups).map((group, index) => {
        const rects = Array.from(group.querySelectorAll('rect'));
        const outerRect = rects[1] || rects[0];
        const innerRect = rects[3] || rects[2] || rects[0];
        
        return {
          index,
          outer: {
            x: parseFloat(outerRect?.getAttribute('x') || '0'),
            y: parseFloat(outerRect?.getAttribute('y') || '0'),
            w: parseFloat(outerRect?.getAttribute('width') || '0'),
            h: parseFloat(outerRect?.getAttribute('height') || '0'),
            rx: parseFloat(outerRect?.getAttribute('rx') || '0'),
          },
          inner: {
            x: parseFloat(innerRect?.getAttribute('x') || '0'),
            y: parseFloat(innerRect?.getAttribute('y') || '0'),
            w: parseFloat(innerRect?.getAttribute('width') || '0'),
            h: parseFloat(innerRect?.getAttribute('height') || '0'),
            rx: parseFloat(innerRect?.getAttribute('rx') || '0'),
          },
          label: labels[index] || '',
          keyCode: INDEX_TO_MC_KEY[index] || `key.keyboard.unknown_${index}`,
        };
      });
    } catch (e) {
      console.error('Error parsing keyboard layout:', e);
      return [];
    }
  }, []);

  // Map of key values to active bindings list
  const keyToBindsMap = useMemo(() => {
    const map = new Map<string, KeyBind[]>();
    for (const kb of keybindings) {
      if (kb.key && kb.key !== 'key.keyboard.none' && kb.key !== '0') {
        const list = map.get(kb.key) || [];
        list.push(kb);
        map.set(kb.key, list);
      }
    }
    return map;
  }, [keybindings]);

  // Click handler for keys on the visual preview
  const handleKeyClick = (keyCode: string) => {
    if (selectedKeyFilter === keyCode) {
      setSelectedKeyFilter(null);
    } else {
      setSelectedKeyFilter(keyCode);
    }
  };

  // Helper to resolve key styles based on binding status
  const getKeycapStyles = (keyCode: string, isHovered: boolean, isSelected: boolean) => {
    const binds = keyToBindsMap.get(keyCode);
    const isBound = binds && binds.length > 0;
    const isConflicting = binds && binds.length > 1;

    let outerFill = '#222224';
    let outerStroke = '#444446';
    let innerFill = '#1c1c1e';
    let innerStroke = '#3a3a3c';
    let textColor = '#8e8e93';

    if (isConflicting) {
      outerFill = '#3E1818';
      outerStroke = isSelected ? '#ffffff' : '#F97316';
      innerFill = '#2D0F0F';
      innerStroke = '#F97316';
      textColor = '#FFB088';
    } else if (isBound) {
      outerFill = '#102613';
      outerStroke = isSelected ? '#ffffff' : '#10B981';
      innerFill = '#1B2A1E';
      innerStroke = '#10B981';
      textColor = '#A7F3D0';
    } else if (isSelected) {
      outerStroke = '#ffffff';
      innerStroke = '#ffffff';
    }

    if (isHovered) {
      outerStroke = '#ffffff';
    }

    return {
      outerFill,
      outerStroke,
      innerFill,
      innerStroke,
      textColor,
    };
  };

  // Render label text with multi-line support
  const renderLabelText = (label: string, cx: number, cy: number) => {
    if (!label) return null;
    const parts = label.split('\n');
    if (parts.length === 1) {
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-minecraft font-bold pointer-events-none fill-current select-none"
          style={{ fontSize: '0.625rem' }}
        >
          {label}
        </text>
      );
    }
    return (
      <g className="font-minecraft font-bold pointer-events-none fill-current select-none" style={{ fontSize: '0.5625rem' }}>
        <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle">
          {parts[0]}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="middle">
          {parts[1]}
        </text>
      </g>
    );
  };

  // Tooltip content generator
  const renderTooltip = () => {
    if (hoveredKey === null || !hoveredEl) return null;
    const keycap = keycaps[hoveredKey];
    if (!keycap) return null;

    const binds = keyToBindsMap.get(keycap.keyCode) || [];
    const isBound = binds.length > 0;
    const isConflicting = binds.length > 1;
    const friendlyName = getFriendlyKeyName(keycap.keyCode);

    return (
      <div
        className="absolute z-[100] w-[18rem] bg-[#1E1E1F] border-[0.125rem] border-ore-gray-border p-[0.75rem] shadow-ore-glow rounded-[2px] pointer-events-none transform -translate-x-1/2 -translate-y-full font-minecraft"
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
        }}
      >
        <div className="flex items-center justify-between gap-[1rem] border-b border-ore-gray-border/60 pb-[0.375rem] mb-[0.5rem]">
          <span className="text-[1.0625rem] font-bold text-white">{friendlyName}</span>
          <span className="text-[0.875rem] text-[#8e8e93] uppercase font-mono">[{keycap.label.replace('\n', ' ')}]</span>
        </div>

        {isBound ? (
          <div className="flex flex-col gap-[0.375rem]">
            {isConflicting && (
              <div className="text-[#F97316] text-[0.9375rem] font-bold flex items-center gap-[0.25rem] mb-[0.25rem] animate-pulse">
                <AlertTriangle size="0.875rem" className="text-[#F97316]" />
                <span>按键冲突！绑定了多个动作：</span>
              </div>
            )}
            {!isConflicting && (
              <div className="text-ore-green text-[0.9375rem] font-bold mb-[0.25rem]">
                已绑定动作：
              </div>
            )}
            <div className="flex flex-col gap-[0.25rem] max-h-[12rem] overflow-y-auto pr-[0.25rem]">
              {binds.map((b) => (
                <div key={b.name} className="flex flex-col border-l-[0.125rem] border-ore-green/30 pl-[0.5rem] py-[0.125rem]">
                  <span className="text-[1rem] font-bold text-white">{getActionDisplayName(b.name)}</span>
                  <span className="text-[0.875rem] text-[#8e8e93] font-mono">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[#8e8e93] text-[0.9375rem] py-[0.25rem]">
            未绑定动作
          </div>
        )}

        <div className="border-t border-ore-gray-border/40 mt-[0.5rem] pt-[0.375rem] text-[0.8125rem] text-[#8e8e93] text-center">
          点击可在列表中筛选此按键
        </div>
      </div>
    );
  };

  const loadKeybindings = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await invoke<KeyBind[]>('get_instance_keybindings', { instanceId });
      setKeybindings(data);
    } catch (err: any) {
      if (err === 'OPTIONS_TXT_NOT_FOUND') {
        setNotFound(true);
      } else {
        console.error('获取按键配置失败:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeybindings();
  }, [instanceId]);

  const handleInitializeDefault = async () => {
    setLoading(true);
    try {
      await invoke('initialize_default_keybindings', { instanceId });
      addToast('success', t('instanceDetail.game.successInit', '默认按键初始化成功'), 2400);
      void loadKeybindings();
    } catch (err) {
      console.error('初始化按键配置失败:', err);
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    try {
      await invoke('initialize_default_keybindings', { instanceId });
      addToast('success', t('instanceDetail.game.successInit', '默认按键已恢复为默认设置'), 2400);
      void loadKeybindings();
    } catch (err) {
      console.error('恢复默认按键配置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // Conflict calculation
  const conflictCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kb of keybindings) {
      if (kb.key && kb.key !== 'key.keyboard.none' && kb.key !== '0') {
        counts[kb.key] = (counts[kb.key] || 0) + 1;
      }
    }
    return counts;
  }, [keybindings]);

  // Display name helper
  const getActionDisplayName = (actionName: string): string => {
    if (keyboardLoc && keyboardLoc.actions[actionName]) {
      return keyboardLoc.actions[actionName];
    }
    const std = STANDARD_KEYBINDS[actionName];
    if (std) {
      return isZh ? std.zh : std.en;
    }
    return actionName;
  };

  const getFriendlyKeyName = (keyVal: string): string => {
    if (!keyVal) return "-";
    if (keyboardLoc && keyboardLoc.keys[keyVal]) {
      return keyboardLoc.keys[keyVal];
    }
    if (FRIENDLY_KEYS[keyVal]) {
      return isZh ? FRIENDLY_KEYS[keyVal].zh : FRIENDLY_KEYS[keyVal].en;
    }
    if (keyVal.startsWith("key.keyboard.")) {
      const rawName = keyVal.replace("key.keyboard.", "");
      return rawName.toUpperCase();
    }
    if (LWJGL_KEYS[keyVal]) {
      return LWJGL_KEYS[keyVal];
    }
    return keyVal;
  };

  // Filtered Keybinds
  const filteredKeybindings = useMemo(() => {
    let list = keybindings;
    if (selectedKeyFilter) {
      list = list.filter((kb) => kb.key === selectedKeyFilter);
    }
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter((kb) => {
      const dispName = getActionDisplayName(kb.name).toLowerCase();
      const rawName = kb.name.toLowerCase();
      const keyFriendly = getFriendlyKeyName(kb.key).toLowerCase();
      const keyRaw = kb.key.toLowerCase();
      return dispName.includes(query) || rawName.includes(query) || keyFriendly.includes(query) || keyRaw.includes(query);
    });
  }, [keybindings, searchQuery, selectedKeyFilter, isZh]);

  // Sorted Keybindings
  const sortedKeybindings = useMemo(() => {
    const list = [...filteredKeybindings];
    list.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = getActionDisplayName(a.name);
        valB = getActionDisplayName(b.name);
      } else if (sortField === 'key') {
        valA = getFriendlyKeyName(a.key);
        valB = getFriendlyKeyName(b.key);
      } else if (sortField === 'status') {
        const isConflictA = (conflictCountMap[a.key] || 0) > 1;
        const isConflictB = (conflictCountMap[b.key] || 0) > 1;
        if (isConflictA !== isConflictB) {
          return sortOrder === 'asc'
            ? (isConflictA ? -1 : 1)
            : (isConflictA ? 1 : -1);
        }
        valA = getActionDisplayName(a.name);
        valB = getActionDisplayName(b.name);
      }

      return sortOrder === 'asc'
        ? valA.localeCompare(valB, 'zh')
        : valB.localeCompare(valA, 'zh');
    });
    return list;
  }, [filteredKeybindings, sortField, sortOrder, conflictCountMap]);

  // Save specific keybind
  const saveKeybind = async (name: string, newKey: string) => {
    setSaving(true);
    const updated = keybindings.map((kb) => {
      if (kb.name === name) {
        return { ...kb, key: newKey };
      }
      return kb;
    });

    try {
      await invoke('save_instance_keybindings', { instanceId, keybindings: updated });
      setKeybindings(updated);
      addToast('success', t('instanceDetail.game.successSave', '按键已保存'), 2000);
    } catch (err) {
      console.error('保存按键失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // Global keydown capture while editing
  useEffect(() => {
    if (!editingBind) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mcKey = mapEventCodeToMcKey(e.code);
      void saveKeybind(editingBind.name, mcKey);
      setEditingBind(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editingBind]);

  const bindMouse = (mouseKey: string) => {
    if (!editingBind) return;
    void saveKeybind(editingBind.name, mouseKey);
    setEditingBind(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="flex h-[10rem] items-center justify-center text-ore-text-muted">
          <Loader2 size="1.5rem" className="animate-spin mr-[0.5rem]" />
          <span className="text-[1.0625rem]">正在加载配置文件...</span>
        </div>
      </SettingsSection>
    );
  }

  if (notFound) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="mx-[1.5rem] my-[1.25rem] border-[0.125rem] border-dashed border-ore-gray-border bg-[#1E1E1F]/50 p-[1.5rem] flex flex-col items-center justify-center text-center font-minecraft rounded-[2px]">
          <AlertTriangle size="2.25rem" className="text-ore-gold mb-[0.75rem] animate-bounce" />
          <h4 className="text-[1.25rem] text-white mb-[0.25rem]">{t('instanceDetail.game.keyNotFound', '未找到配置文件')}</h4>
          <p className="text-[1.0625rem] text-ore-text-muted max-w-[28rem] mb-[1.25rem]">
            {t('instanceDetail.game.keyNotFoundDesc', '未检测到 options.txt 配置文件，可能因为该实例尚未运行过。您可以初始化一个默认按键布局。')}
          </p>
          <OreButton
            focusKey="keybind-btn-init"
            variant="primary"
            onClick={handleInitializeDefault}
          >
            {t('instanceDetail.game.initDefault', '初始化默认按键')}
          </OreButton>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
      <div className="flex flex-col w-full font-minecraft relative px-[1.5rem] py-[1.25rem]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-[0.75rem] mb-[1.25rem]">
          <div className="flex items-center gap-[0.75rem] flex-1 min-w-[20rem]">
            <div className="relative flex-1">
              <Search size="1.125rem" className="absolute left-[0.75rem] top-1/2 -translate-y-1/2 text-ore-text-muted pointer-events-none" />
              <input
                type="text"
                placeholder={t('instanceDetail.game.searchPlaceholder', '搜索按键名称、键名或描述...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141415] border-[0.125rem] border-ore-gray-border hover:border-white/50 focus:border-ore-green pl-[2.5rem] pr-[1rem] py-[0.5rem] text-[1.125rem] text-white outline-none rounded-[2px] transition-all"
              />
            </div>
            
            {selectedKeyFilter && (
              <div className="flex items-center gap-[0.375rem] bg-[#23301F] border border-ore-green/30 px-[0.75rem] py-[0.5rem] rounded-[2px] shrink-0 animate-fade-in">
                <span className="text-[1.0625rem] text-[#8e8e93]">筛选:</span>
                <span className="text-[1.0625rem] font-bold text-ore-green">{getFriendlyKeyName(selectedKeyFilter)}</span>
                <button
                  onClick={() => setSelectedKeyFilter(null)}
                  className="text-[0.9375rem] text-[#8e8e93] hover:text-white ml-[0.375rem] focus:outline-none transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-[0.75rem]">
            <OreButton
              focusKey="keybind-btn-reset"
              variant="secondary"
              onClick={handleResetToDefault}
              disabled={saving}
              className="flex items-center gap-[0.375rem]"
            >
              <RotateCw size="1rem" className={saving ? 'animate-spin' : ''} />
              <span className="text-[1.0625rem]">{t('instanceDetail.game.resetBtn', '恢复默认按键')}</span>
            </OreButton>
          </div>
        </div>

        {/* Keyboard Layout Preview */}
        <div className="keyboard-preview-container w-full border-[0.125rem] border-ore-gray-border bg-[#141415] rounded-[2px] p-[0.75rem] mb-[1.25rem] relative z-30 select-none">
          <div className="text-[1.0625rem] font-bold text-ore-text-muted mb-[0.625rem] flex flex-wrap items-center justify-between gap-[0.5rem] px-[0.25rem]">
            <div className="flex items-center gap-[0.5rem] flex-wrap">
              <Keyboard size="1.125rem" className="text-ore-green" />
              <span>按键映射与冲突可视化预览</span>
              {keyboardLoc && (
                <span className="text-[0.875rem] text-[#8e8e93] font-normal ml-[0.5rem] select-none bg-black/20 px-[0.5rem] py-[0.125rem] rounded-[2px] animate-fade-in">
                  本地化源: {locLang}.json (v{keyboardLoc.metadata.version} by {keyboardLoc.metadata.authors.join(', ')})
                </span>
              )}
            </div>
            <div className="flex items-center gap-[1rem] text-[0.9375rem] font-normal">
              <div className="flex items-center gap-[0.375rem]">
                <span className="w-[0.75rem] h-[0.75rem] bg-[#1B2A1E] border border-[#10B981] rounded-[2px]" />
                <span>已绑定</span>
              </div>
              <div className="flex items-center gap-[0.375rem]">
                <span className="w-[0.75rem] h-[0.75rem] bg-[#2D0F0F] border border-dashed border-[#F97316] rounded-[2px] flex items-center justify-center text-[0.5rem] font-bold text-[#F97316]">⚠</span>
                <span>有冲突 (⚠ + 虚线)</span>
              </div>
              <div className="flex items-center gap-[0.375rem]">
                <span className="w-[0.75rem] h-[0.75rem] bg-[#1c1c1e] border border-[#3a3a3c] rounded-[2px]" />
                <span>未绑定</span>
              </div>
            </div>
          </div>
          
          <div className="relative w-full overflow-x-auto overflow-y-hidden pb-[0.25rem]">
            <svg
              width="100%"
              height="auto"
              viewBox="0 0 1245 381"
              className="w-full h-auto text-white select-none"
              style={{ minWidth: '900px' }}
            >
              <defs>
                <linearGradient id="DCS">
                  <stop offset="0%" stopColor="black" stopOpacity="0"/>
                  <stop offset="40%" stopColor="black" stopOpacity="0.1"/>
                  <stop offset="60%" stopColor="black" stopOpacity="0.1"/>
                  <stop offset="100%" stopColor="black" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="SPACE" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="black" stopOpacity="0.1"/>
                  <stop offset="20%" stopColor="black" stopOpacity="0.0"/>
                  <stop offset="40%" stopColor="black" stopOpacity="0.0"/>
                  <stop offset="100%" stopColor="black" stopOpacity="0.1"/>
                </linearGradient>
                <radialGradient id="DSA">
                  <stop offset="0%" stopColor="black" stopOpacity="0.1"/>
                  <stop offset="10%" stopColor="black" stopOpacity="0.1"/>
                  <stop offset="100%" stopColor="black" stopOpacity="0"/>
                </radialGradient>
              </defs>

              <g transform="translate(10,10)">
                <rect
                  width="1225"
                  height="361"
                  stroke="#2a2a2c"
                  strokeWidth="1"
                  fill="#141415"
                  rx="6"
                />
                
                <g transform="translate(5,5)">
                  {keycaps.map((keycap) => {
                    const isHovered = hoveredKey === keycap.index;
                    const isSelected = selectedKeyFilter === keycap.keyCode;
                    const styles = getKeycapStyles(keycap.keyCode, isHovered, isSelected);

                    const binds = keyToBindsMap.get(keycap.keyCode);
                    const isConflicting = binds && binds.length > 1;

                    const cx = keycap.inner.x + keycap.inner.w / 2;
                    const cy = keycap.inner.y + keycap.inner.h / 2;

                    return (
                      <g
                        key={keycap.index}
                        className="cursor-pointer transition-all duration-150"
                        onClick={() => handleKeyClick(keycap.keyCode)}
                        onMouseEnter={(e) => {
                          setHoveredKey(keycap.index);
                          setHoveredEl(e.currentTarget as any);
                        }}
                        onMouseLeave={() => {
                          setHoveredKey(null);
                          setHoveredEl(null);
                        }}
                        style={{
                          filter: isHovered || isSelected ? 'drop-shadow(0 0 4px rgba(64, 181, 58, 0.4))' : 'none',
                        }}
                      >
                        {/* Outer Border */}
                        <rect
                          x={keycap.outer.x}
                          y={keycap.outer.y}
                          width={keycap.outer.w}
                          height={keycap.outer.h}
                          rx={keycap.outer.rx}
                          fill={styles.outerFill}
                          stroke={styles.outerStroke}
                          strokeWidth={isSelected || isHovered ? "2" : "1"}
                        />
                        
                        {/* Inner Fill */}
                        <rect
                          x={keycap.inner.x}
                          y={keycap.inner.y}
                          width={keycap.inner.w}
                          height={keycap.inner.h}
                          rx={keycap.inner.rx}
                          fill={styles.innerFill}
                          stroke={styles.innerStroke}
                          strokeWidth="1"
                          strokeDasharray={isConflicting ? "3 1.5" : undefined}
                        />

                        {/* Text Label */}
                        <g fill={styles.textColor}>
                          {renderLabelText(keycap.label, cx, cy)}
                        </g>

                        {/* Visual warning icon for conflicts */}
                        {isConflicting && (
                          <text
                            x={keycap.inner.x + keycap.inner.w - 5}
                            y={keycap.inner.y + 4}
                            textAnchor="end"
                            dominantBaseline="hanging"
                            className="font-minecraft font-bold pointer-events-none select-none fill-[#F97316]"
                            style={{ fontSize: '0.5625rem' }}
                          >
                            ⚠
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>
          </div>
          {renderTooltip()}
        </div>

        {/* Bindings Table */}
        <div className="border-[0.125rem] border-ore-gray-border bg-[#141415] rounded-[2px] overflow-hidden flex flex-col h-[30rem]">
          {/* Table Header with Sorting */}
          <div className="grid grid-cols-[1.5fr_1.2fr_0.8fr] bg-[#1E1E1F] border-b-[0.125rem] border-ore-gray-border px-[1rem] py-[0.625rem] text-[1.0625rem] uppercase tracking-[0.08em] text-ore-text-muted select-none">
            <div 
              className="cursor-pointer flex items-center gap-[0.25rem] hover:text-white transition-colors" 
              onClick={() => toggleSort('name')}
            >
              <span>动作</span>
              <span className="text-[0.875rem] font-bold text-ore-green">
                {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </span>
            </div>
            <div 
              className="cursor-pointer flex items-center gap-[0.25rem] hover:text-white transition-colors" 
              onClick={() => toggleSort('key')}
            >
              <span>映射按键</span>
              <span className="text-[0.875rem] font-bold text-ore-green">
                {sortField === 'key' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </span>
            </div>
            <div 
              className="cursor-pointer flex justify-end items-center gap-[0.25rem] hover:text-white transition-colors" 
              onClick={() => toggleSort('status')}
            >
              <span>状态</span>
              <span className="text-[0.875rem] font-bold text-ore-green">
                {sortField === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </span>
            </div>
          </div>

          <OreOverlayScrollArea className="flex-1 min-h-0" contentClassName="divide-y-[0.125rem] divide-ore-gray-border/40">
            {sortedKeybindings.length === 0 ? (
              <div className="flex h-[8rem] flex-col items-center justify-center text-center text-[1.125rem] text-ore-text-muted">
                {t('libraryPage.empty.noMatchTitle', '没有匹配项目')}
              </div>
            ) : (
              sortedKeybindings.map((kb) => {
                const isConflicting = (conflictCountMap[kb.key] || 0) > 1;
                return (
                  <FocusItem
                    key={kb.name}
                    focusKey={`keybind-item-${kb.name}`}
                    onEnter={() => setEditingBind(kb)}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any}
                        onClick={() => setEditingBind(kb)}
                        className={`grid grid-cols-[1.5fr_1.2fr_0.8fr] items-center px-[1rem] py-[0.75rem] cursor-pointer select-none transition-all outline-none border-[0.125rem] border-transparent ${
                          focused
                            ? 'bg-ore-green/10 border-ore-focus drop-shadow-ore-glow'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-[0.5rem]">
                          <span className="text-[1.125rem] font-bold text-white truncate">{getActionDisplayName(kb.name)}</span>
                          <span className="text-[1.0625rem] text-ore-text-muted truncate mt-[0.125rem]">{kb.name}</span>
                        </div>

                        <div className="text-[1.125rem] font-minecraft text-ore-green truncate">
                          {getFriendlyKeyName(kb.key)}
                        </div>

                        <div className="flex justify-end items-center">
                          {isConflicting ? (
                            <span className="inline-flex items-center gap-[0.25rem] bg-[#3A1414] border border-[#ff4d4d]/30 text-[#ff4d4d] px-[0.5rem] py-[0.125rem] rounded-[2px] text-[1.0625rem] font-bold">
                              <AlertTriangle size="0.875rem" />
                              {t('instanceDetail.game.conflict', '冲突')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[0.25rem] bg-[#23301F] border border-ore-green/30 text-ore-green px-[0.5rem] py-[0.125rem] rounded-[2px] text-[1.0625rem] font-bold">
                              <CheckCircle2 size="0.875rem" />
                              {t('instanceDetail.game.noConflict', '正常')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </FocusItem>
                );
              })
            )}
          </OreOverlayScrollArea>
        </div>
      </div>

      {/* Editing Dialog Modal */}
      {editingBind && (
        <OreModal
          isOpen={true}
          onClose={() => setEditingBind(null)}
          title={t('instanceDetail.game.editBtn', '更改按键绑定')}
          className="w-[min(26rem,94vw)] z-[9999]"
          contentClassName="p-[1.5rem] text-center font-minecraft"
          actions={
            <div className="flex w-full flex-col gap-[0.75rem] px-[0.5rem] pb-[0.25rem]">
              <div className="grid grid-cols-3 gap-[0.75rem]">
                <OreButton
                  focusKey="mouse-btn-left"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.left')}
                  className="w-full py-[0.625rem]"
                >
                  <span className="text-[1.0625rem]">{t('instanceDetail.game.mouseLeft', '鼠标左键')}</span>
                </OreButton>
                <OreButton
                  focusKey="mouse-btn-right"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.right')}
                  className="w-full py-[0.625rem]"
                >
                  <span className="text-[1.0625rem]">{t('instanceDetail.game.mouseRight', '鼠标右键')}</span>
                </OreButton>
                <OreButton
                  focusKey="mouse-btn-middle"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.middle')}
                  className="w-full py-[0.625rem]"
                >
                  <span className="text-[1.0625rem]">{t('instanceDetail.game.mouseMiddle', '鼠标中键')}</span>
                </OreButton>
              </div>
              <OreButton
                focusKey="edit-btn-cancel"
                variant="primary"
                onClick={() => setEditingBind(null)}
                className="w-full py-[0.625rem]"
              >
                <span className="text-[1.125rem]">{t('common.cancel', '取消')}</span>
              </OreButton>
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center gap-[1.25rem] select-none py-[0.5rem]">
            <Keyboard size="3.5rem" className="text-ore-green animate-pulse" />
            <h4 className="text-[1.25rem] text-white font-bold">
              {getActionDisplayName(editingBind.name)}
            </h4>
            <p className="text-[1.125rem] text-ore-text-muted">
              {t('instanceDetail.game.pressKey', '请按下一个按键...')}
            </p>
            <div className="text-[1.0625rem] text-[#8e8e93] px-[1rem] py-[0.5rem] bg-black/20 rounded-[2px] leading-relaxed max-w-[20rem]">
              {t('instanceDetail.game.pressKeyDesc', '按下键盘上的按键，或点击下方按钮绑定鼠标。')}
            </div>
          </div>
        </OreModal>
      )}
    </SettingsSection>
  );
};
