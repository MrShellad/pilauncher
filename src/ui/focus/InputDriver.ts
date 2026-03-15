// /src/ui/focus/InputDriver.ts
import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type InputAction = 
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' 
  | 'CONFIRM' | 'CANCEL' 
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT'
  | 'TAB_LEFT' | 'TAB_RIGHT' // ✅ 新增：专供顶层主导航使用的动作
  | 'ACTION_X' | 'ACTION_Y';

export type InputMode = "mouse" | "keyboard" | "controller";

// ------------------------------------------------------------------
// 1. JSON 键位映射配置 (可从外部 JSON 文件或 localStorage 动态加载)
// ------------------------------------------------------------------
export const defaultBindings = {
  keyboard: {
    'ArrowUp': 'UP',
    'ArrowDown': 'DOWN',
    'ArrowLeft': 'LEFT',
    'ArrowRight': 'RIGHT',
    'Enter': 'CONFIRM',
    'Escape': 'CANCEL',
    ';': 'PAGE_LEFT',    // 设置页向左
    "'": 'PAGE_RIGHT',   // 设置页向右
    '[': 'TAB_LEFT',     // ✅ 主导航向左
    ']': 'TAB_RIGHT',    // ✅ 主导航向右
    'x': 'ACTION_X',
    'y': 'ACTION_Y'  
  } as Record<string, InputAction>,
  gamepad: {
    buttons: {
      0: 'CONFIRM', 1: 'CANCEL', 
      12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
      4: 'TAB_LEFT', 5: 'TAB_RIGHT',       // ✅ 4: LB, 5: RB 分配给全局主导航
      6: 'PAGE_LEFT', 7: 'PAGE_RIGHT',     // ✅ 6: LT, 7: RT 分配给设置页子导航
      9: 'MENU', 8: 'VIEW',
      2: 'ACTION_X', 
      3: 'ACTION_Y',  
    } as Record<number, InputAction>,
    axes: {
      0: { negative: 'LEFT', positive: 'RIGHT' }, // 左摇杆 X轴
      1: { negative: 'UP', positive: 'DOWN' }     // 左摇杆 Y轴
    } as Record<number, { negative: InputAction, positive: InputAction }>
  }
};

// ------------------------------------------------------------------
// 2. 长按连续滚动的节流配置
// ------------------------------------------------------------------
const REPEAT_DELAY = 300; 
const REPEAT_RATE = 50;   
const AXIS_DEADZONE = 0.5;

export const useInputAction = (action: InputAction, callback: () => void) => {
  useEffect(() => {
    const handler = (e: CustomEvent<InputAction>) => {
      if (e.detail === action) callback();
    };
    window.addEventListener('ore-action', handler as EventListener);
    return () => window.removeEventListener('ore-action', handler as EventListener);
  }, [action, callback]);
};

const dispatchAction = (action: InputAction, source: InputMode = 'controller') => {
  window.dispatchEvent(new CustomEvent('ore-action', { detail: action }));
  
  if (source === 'controller') {
    const key = Object.keys(defaultBindings.keyboard).find(
      k => defaultBindings.keyboard[k] === action
    );
    if (key) {
      const target = document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
  }
};

// ------------------------------------------------------------------
// 3. 核心驱动：支持节流与自定义映射
// ------------------------------------------------------------------
export const useInputDriver = (
  onModeChange: (mode: InputMode) => void,
  bindings = defaultBindings 
) => {
  const activeActions = useRef<Map<InputAction, { start: number; lastFire: number }>>(new Map());
  const requestRef = useRef<number>(0);
  const activeKeys = useRef<Set<string>>(new Set());
  const hasGamepadRef = useRef<boolean>(false);
  const nativeButtonsRef = useRef<Set<number>>(new Set());

  const triggerAction = (action: InputAction, mode: InputMode, now: number) => {
    const record = activeActions.current.get(action);
    if (!record) {
      onModeChange(mode);
      dispatchAction(action, mode);
      activeActions.current.set(action, { start: now, lastFire: now });
    } else {
      if (now - record.start > REPEAT_DELAY && now - record.lastFire > REPEAT_RATE) {
        dispatchAction(action, mode);
        record.lastFire = now;
      }
    }
  };

  useEffect(() => {
    const readFirstGamepad = () => {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (gp && gp.connected) return gp;
      }
      return null;
    };

    const loop = (now: number) => {
      const currentGamepadActions = new Set<InputAction>();
      const useNative = nativeButtonsRef.current.size > 0;

      if (useNative) {
        nativeButtonsRef.current.forEach((code) => {
          const action = bindings.gamepad.buttons[code];
          if (action) currentGamepadActions.add(action);
        });
      } else {
        const gp = readFirstGamepad();
        if (gp) {
          Object.entries(bindings.gamepad.axes).forEach(([axisIndexStr, mapping]) => {
            const axisIndex = parseInt(axisIndexStr);
            const value = gp.axes[axisIndex];
            if (value < -AXIS_DEADZONE) currentGamepadActions.add(mapping.negative);
            else if (value > AXIS_DEADZONE) currentGamepadActions.add(mapping.positive);
          });

          gp.buttons.forEach((button, index) => {
            if (button.pressed && bindings.gamepad.buttons[index]) {
              currentGamepadActions.add(bindings.gamepad.buttons[index]);
            }
          });
        }
      }

      currentGamepadActions.forEach(action => triggerAction(action, 'controller', now));

      const currentKeyboardActions = new Set<InputAction>();
      activeKeys.current.forEach(key => {
        const action = bindings.keyboard[key];
        if (action) currentKeyboardActions.add(action);
      });
      currentKeyboardActions.forEach(action => triggerAction(action, 'keyboard', now));

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

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.key);
    };

    const handleMouse = () => {
      activeActions.current.clear();
      activeKeys.current.clear();
      onModeChange('mouse');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('mousedown', handleMouse, { passive: true });

    const notifyGamepadConnected = (gp: Gamepad | null) => {
      if (!gp) return;
      if (!hasGamepadRef.current) {
        hasGamepadRef.current = true;
        window.dispatchEvent(
          new CustomEvent('ore-gamepad-connected', {
            detail: { id: gp.id }
          })
        );
      }
    };

    const handleGamepadConnected = (e: GamepadEvent) => {
      notifyGamepadConnected(e.gamepad);
    };

    const handleGamepadDisconnected = () => {
      hasGamepadRef.current = false;
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected as EventListener);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected as EventListener);

    // Steam Deck Game Mode / Electron 环境下，原生事件可能不会触发，启用轻量轮询探测连接状态
    const connectionPoll = window.setInterval(() => {
      const gp = readFirstGamepad();
      if (gp) {
        notifyGamepadConnected(gp);
      } else {
        hasGamepadRef.current = false;
      }
    }, 1000);

    // 通过 Tauri 后端 (gilrs) 接收跨平台原生手柄事件
    let unlistenNative: UnlistenFn | null = null;
    listen<{
      id: number;
      kind: string;
      button_code?: number | null;
    }>('native-gamepad-event', (event) => {
      const { kind, button_code } = event.payload;
      if (kind === 'Connected') {
        hasGamepadRef.current = true;
        window.dispatchEvent(
          new CustomEvent('ore-gamepad-connected', {
            detail: { id: `native-${event.payload.id}` }
          })
        );
        return;
      }
      if (kind === 'Disconnected') {
        hasGamepadRef.current = false;
        nativeButtonsRef.current.clear();
        return;
      }
      if (typeof button_code === 'number') {
        if (kind === 'ButtonPressed') {
          nativeButtonsRef.current.add(button_code);
        } else if (kind === 'ButtonReleased') {
          nativeButtonsRef.current.delete(button_code);
        }
      }
    }).then((fn) => {
      unlistenNative = fn;
    }).catch(() => {
      // ignore if event bridge not available
    });

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mousedown', handleMouse);
      window.removeEventListener('gamepadconnected', handleGamepadConnected as EventListener);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected as EventListener);
      window.clearInterval(connectionPoll);
      if (unlistenNative) {
        unlistenNative();
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onModeChange, bindings]);
};