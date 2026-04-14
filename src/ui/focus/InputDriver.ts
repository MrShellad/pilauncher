// /src/ui/focus/InputDriver.ts
import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type InputAction =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'CONFIRM' | 'CANCEL'
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT'
  | 'TAB_LEFT' | 'TAB_RIGHT'
  | 'ACTION_X' | 'ACTION_Y';

export type InputMode = "mouse" | "keyboard" | "controller";

// ------------------------------------------------------------------
// 1. JSON 键位映射配置
// ------------------------------------------------------------------
export const defaultBindings = {
  keyboard: {
    'ArrowUp': 'UP', 'ArrowDown': 'DOWN', 'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT',
    'Enter': 'CONFIRM', 'Escape': 'CANCEL',
    ';': 'PAGE_LEFT', "'": 'PAGE_RIGHT', '[': 'TAB_LEFT', ']': 'TAB_RIGHT',
    'x': 'ACTION_X', 'y': 'ACTION_Y'
  } as Record<string, InputAction>,
  gamepad: {
    buttons: {
      // 🌟 优先使用字符串名称进行直观映射
      'South': 'CONFIRM',
      'East': 'CANCEL',
      'North': 'ACTION_Y',
      'West': 'ACTION_X',
      'LeftTrigger': 'TAB_LEFT',
      'LeftTrigger2': 'PAGE_LEFT',
      'RightTrigger': 'TAB_RIGHT',
      'RightTrigger2': 'PAGE_RIGHT',
      'Select': 'VIEW',
      'Start': 'MENU',
      'DPadUp': 'UP',
      'DPadDown': 'DOWN',
      'DPadLeft': 'LEFT',
      'DPadRight': 'RIGHT',
      // 数字备份 (防止驱动没返回名称)
      0: 'CONFIRM', 1: 'CANCEL', 2: 'ACTION_Y', 3: 'ACTION_X',
      6: 'TAB_LEFT', 7: 'PAGE_LEFT', 8: 'TAB_RIGHT', 9: 'PAGE_RIGHT',
      10: 'VIEW', 11: 'MENU',
      16: 'UP', 17: 'DOWN', 18: 'LEFT', 19: 'RIGHT'
    } as Record<string | number, InputAction>,
    axes: {
      'LeftStickX': { negative: 'LEFT', positive: 'RIGHT' },
      // 修正：大多数驱动上，LeftStickY 向上为负值，向下为正值，这里反转映射
      'LeftStickY': { negative: 'DOWN', positive: 'UP' },
      0: { negative: 'LEFT', positive: 'RIGHT' },
      1: { negative: 'DOWN', positive: 'UP' }
    } as Record<string | number, { negative: InputAction, positive: InputAction }>
  }
};

const REPEAT_DELAY = 300;
const REPEAT_RATE = 50;
const AXIS_DEADZONE = 0.5;
const MOUSE_THRESHOLD = 5;

// 辅助函数：补全 KeyboardEvent 的关键属性，确保 spatial navigation 能识别
const getKeyEventProps = (key: string) => {
  const props: any = { key };
  if (key === 'ArrowUp') { props.keyCode = 38; props.code = 'ArrowUp'; }
  else if (key === 'ArrowDown') { props.keyCode = 40; props.code = 'ArrowDown'; }
  else if (key === 'ArrowLeft') { props.keyCode = 37; props.code = 'ArrowLeft'; }
  else if (key === 'ArrowRight') { props.keyCode = 39; props.code = 'ArrowRight'; }
  else if (key === 'Enter') { props.keyCode = 13; props.code = 'Enter'; }
  else if (key === 'Escape') { props.keyCode = 27; props.code = 'Escape'; }
  return props;
};

export const useInputAction = (action: InputAction, callback: () => void) => {
  useEffect(() => {
    const handler = (e: CustomEvent<InputAction>) => {
      if (e.detail === action) callback();
    };
    window.addEventListener('ore-action', handler as EventListener);
    return () => window.removeEventListener('ore-action', handler as EventListener);
  }, [action, callback]);
};

const dispatchAction = (action: InputAction, bindings: typeof defaultBindings, source: InputMode = 'controller') => {
  window.dispatchEvent(new CustomEvent('ore-action', { detail: action }));

  if (source === 'controller') {
    const key = Object.keys(bindings.keyboard).find(
      k => bindings.keyboard[k] === action
    );
    if (key) {
      const target = document.activeElement || document.body;
      const eventProps = getKeyEventProps(key);
      const event = new KeyboardEvent('keydown', {
        ...eventProps,
        bubbles: true,
        cancelable: true,
        composed: true
      });

      // 注入兼容性属性
      if (eventProps.keyCode) {
        Object.defineProperty(event, 'keyCode', { value: eventProps.keyCode });
        Object.defineProperty(event, 'which', { value: eventProps.keyCode });
      }

      target.dispatchEvent(event);
    }
  }
};

export const useInputDriver = (
  onModeChange: (mode: InputMode) => void,
  bindings = defaultBindings
) => {
  const activeActions = useRef<Map<InputAction, { start: number; lastFire: number }>>(new Map());
  const requestRef = useRef<number>(0);
  const activeKeys = useRef<Set<string>>(new Set());

  // 🌟 支持以字符串和数字形式存储状态
  const nativeButtonsRef = useRef<Set<string | number>>(new Set());
  const nativeAxesRef = useRef<Record<string | number, number>>({});
  const lastAxisActionRef = useRef<Record<string | number, string>>({});

  const triggerAction = (action: InputAction, mode: InputMode, now: number, bindings: typeof defaultBindings) => {
    const record = activeActions.current.get(action);
    if (!record) {
      onModeChange(mode);
      dispatchAction(action, bindings, mode);
      activeActions.current.set(action, { start: now, lastFire: now });
    } else {
      if (now - record.start > REPEAT_DELAY && now - record.lastFire > REPEAT_RATE) {
        dispatchAction(action, bindings, mode);
        record.lastFire = now;
      }
    }
  };

  useEffect(() => {
    const loop = (now: number) => {
      const currentGamepadActions = new Set<InputAction>();

      // 1. 处理按钮：支持混合索引
      nativeButtonsRef.current.forEach((id) => {
        const action = (bindings.gamepad.buttons as any)[id];
        if (action) currentGamepadActions.add(action);
      });

      // 2. 处理摇杆：支持混合索引
      Object.entries(bindings.gamepad.axes).forEach(([id, mapping]) => {
        const value = nativeAxesRef.current[id] ?? 0;
        if (value < -AXIS_DEADZONE) currentGamepadActions.add(mapping.negative);
        else if (value > AXIS_DEADZONE) currentGamepadActions.add(mapping.positive);
      });

      currentGamepadActions.forEach(action => triggerAction(action, 'controller', now, bindings));

      // 键盘处理逻辑
      const currentKeyboardActions = new Set<InputAction>();
      activeKeys.current.forEach(key => {
        const action = bindings.keyboard[key];
        if (action) currentKeyboardActions.add(action);
      });
      currentKeyboardActions.forEach(action => triggerAction(action, 'keyboard', now, bindings));

      activeActions.current.forEach((_, action) => {
        if (!currentGamepadActions.has(action) && !currentKeyboardActions.has(action)) {
          activeActions.current.delete(action);
        }
      });

      requestRef.current = requestAnimationFrame(loop);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      onModeChange('keyboard');
      activeKeys.current.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => activeKeys.current.delete(e.key);

    let lastMousePos = { x: 0, y: 0 };
    const handleMouse = (e: MouseEvent) => {
      const dx = Math.abs(e.screenX - lastMousePos.x);
      const dy = Math.abs(e.screenY - lastMousePos.y);
      if (dx < MOUSE_THRESHOLD && dy < MOUSE_THRESHOLD) return;

      lastMousePos = { x: e.screenX, y: e.screenY };
      activeActions.current.clear();
      activeKeys.current.clear();
      onModeChange('mouse');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('mousedown', (e) => {
      lastMousePos = { x: e.screenX, y: e.screenY };
      handleMouse(e as any);
    }, { passive: true });

    let unlistenNative: UnlistenFn | null = null;
    const DEBUG_GAMEPAD = true;

    listen<{
      id: number;
      kind: string;
      button_code?: number | null;
      button_name?: string | null;
      axis_code?: number | null;
      axis_name?: string | null;
      axis_value?: number | null;
    }>('native-gamepad-event', (event) => {
      const { kind, button_code, button_name, axis_code, axis_name, axis_value } = event.payload;

      if (kind === 'Connected') {
        if (DEBUG_GAMEPAD) console.log(`[手柄 🔌] 设备已连接, ID: native-${event.payload.id}`);
        window.dispatchEvent(new CustomEvent('ore-gamepad-connected', { detail: { id: `native-${event.payload.id}` } }));
        return;
      }

      if (kind === 'Disconnected') {
        if (DEBUG_GAMEPAD) console.log(`[手柄 ❌] 设备已断开`);
        nativeButtonsRef.current.clear();
        nativeAxesRef.current = {};
        lastAxisActionRef.current = {};
        return;
      }

      // 🔘 更新按钮状态池 (支持双索引缓存，杜绝按键映射冲突)
      if (button_name || typeof button_code === 'number') {
        const name = button_name || 'unknown';
        const code = Number(button_code);

        const isPressed = kind === 'ButtonPressed' || (kind === 'ButtonChanged' && (axis_value || 0) > 0.5);
        const isReleased = kind === 'ButtonReleased' || (kind === 'ButtonChanged' && (axis_value || 0) < 0.2);

        if (isPressed) {
          // ✅ 核心修复：防止手柄驱动映射错乱导致一个按键同时触发 CONFIRM 和 CANCEL
          const actionByName = name !== 'unknown' ? (bindings.gamepad.buttons as any)[name] : undefined;
          const actionByCode = typeof button_code === 'number' ? (bindings.gamepad.buttons as any)[code] : undefined;

          if (actionByName && actionByCode && actionByName !== actionByCode) {
            // 发生冲突时，优先信任 Name (标准化语义)
            nativeButtonsRef.current.add(name);
          } else if (actionByName) {
            nativeButtonsRef.current.add(name);
          } else if (actionByCode) {
            nativeButtonsRef.current.add(code);
          } else {
            // 如果都没映射，兜底存入
            if (name !== 'unknown') nativeButtonsRef.current.add(name);
            if (typeof button_code === 'number') nativeButtonsRef.current.add(code);
          }

          if (DEBUG_GAMEPAD) {
            const action = actionByName || actionByCode;
            console.log(`[按键按下] ${name}(${code}) => ${action}`);
          }
        } else if (isReleased) {
          // 释放时无论当时存的哪一个，统统清理以防万一
          if (name !== 'unknown') nativeButtonsRef.current.delete(name);
          if (typeof button_code === 'number') nativeButtonsRef.current.delete(code);
        }
      }

      // 🕹️ 更新摇杆状态池 (支持双索引缓存，杜绝摇杆映射冲突)
      if (kind === 'AxisChanged' && (axis_name || typeof axis_code === 'number') && typeof axis_value === 'number') {
        const name = axis_name || 'unknown';
        const code = Number(axis_code);

        const mappingByName = name !== 'unknown' ? (bindings.gamepad.axes as any)[name] : undefined;
        const mappingByCode = typeof button_code === 'number' ? (bindings.gamepad.axes as any)[code] : undefined;

        if (mappingByName && mappingByCode && mappingByName !== mappingByCode) {
          nativeAxesRef.current[name] = axis_value;
        } else if (mappingByName) {
          nativeAxesRef.current[name] = axis_value;
        } else if (mappingByCode) {
          nativeAxesRef.current[code] = axis_value;
        } else {
          if (name !== 'unknown') nativeAxesRef.current[name] = axis_value;
          nativeAxesRef.current[code] = axis_value;
        }

        if (DEBUG_GAMEPAD) {
          const mapping = mappingByName || mappingByCode;
          let currentAction = 'DEADZONE';
          if (mapping) {
            if (axis_value < -AXIS_DEADZONE) currentAction = mapping.negative;
            else if (axis_value > AXIS_DEADZONE) currentAction = mapping.positive;
          }
          if (lastAxisActionRef.current[name] !== currentAction) {
            lastAxisActionRef.current[name] = currentAction;
          }
        }
      }
    }).then(fn => { unlistenNative = fn; });

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mousedown', handleMouse);
      if (unlistenNative) unlistenNative();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onModeChange, bindings]);
};