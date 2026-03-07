// /src/ui/focus/InputDriver.ts
import { useEffect, useRef } from 'react';

export type InputAction = 
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' 
  | 'CONFIRM' | 'CANCEL' 
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT'
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
    '[': 'PAGE_LEFT',
    ']': 'PAGE_RIGHT',
    'x': 'ACTION_X',
    'y': 'ACTION_Y'  
  } as Record<string, InputAction>,
  gamepad: {
    buttons: {
      0: 'CONFIRM', 1: 'CANCEL', 
      12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
      4: 'PAGE_LEFT', 5: 'PAGE_RIGHT', 
      6: 'PAGE_LEFT', 7: 'PAGE_RIGHT', // LT, RT
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
const REPEAT_DELAY = 300; // 按下多久后开始连续触发 (毫秒)
const REPEAT_RATE = 50;   // 连续触发的频率 (毫秒)
const AXIS_DEADZONE = 0.5;// 摇杆防漂移死区

export const useInputAction = (action: InputAction, callback: () => void) => {
  useEffect(() => {
    const handler = (e: CustomEvent<InputAction>) => {
      if (e.detail === action) callback();
    };
    window.addEventListener('ore-action', handler as EventListener);
    return () => window.removeEventListener('ore-action', handler as EventListener);
  }, [action, callback]);
};

// 统一分发虚拟事件及模拟真实键盘事件
const dispatchAction = (action: InputAction, source: InputMode = 'controller') => {
  window.dispatchEvent(new CustomEvent('ore-action', { detail: action }));
  
  if (source === 'controller') {
    // 根据当前映射反推需要模拟的键盘按键
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
  bindings = defaultBindings // 允许外部传入自定义 JSON 配置
) => {
  // 记录所有当前激活的动作及其时间戳 { action: { timestamp, lastFired } }
  const activeActions = useRef<Map<InputAction, { start: number; lastFire: number }>>(new Map());
  const requestRef = useRef<number>(0);
  
  // 记录键盘实际按下的物理键，防止 OS 级别自带的 repeat 干扰我们的统一步伐
  const activeKeys = useRef<Set<string>>(new Set());

  // 触发动作 (带有初次触发和节流逻辑)
  const triggerAction = (action: InputAction, mode: InputMode, now: number) => {
    const record = activeActions.current.get(action);
    if (!record) {
      // 初次按下，立刻触发
      onModeChange(mode);
      dispatchAction(action, mode);
      activeActions.current.set(action, { start: now, lastFire: now });
    } else {
      // 已经按住，检查是否满足长按节流条件
      if (now - record.start > REPEAT_DELAY && now - record.lastFire > REPEAT_RATE) {
        dispatchAction(action, mode);
        record.lastFire = now;
      }
    }
  };

  useEffect(() => {
    const loop = (now: number) => {
      // 1. 处理手柄输入
      const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
      const currentGamepadActions = new Set<InputAction>();

      if (gp) {
        // 解析摇杆
        Object.entries(bindings.gamepad.axes).forEach(([axisIndexStr, mapping]) => {
          const axisIndex = parseInt(axisIndexStr);
          const value = gp.axes[axisIndex];
          if (value < -AXIS_DEADZONE) currentGamepadActions.add(mapping.negative);
          else if (value > AXIS_DEADZONE) currentGamepadActions.add(mapping.positive);
        });

        // 解析按键
        gp.buttons.forEach((button, index) => {
          if (button.pressed && bindings.gamepad.buttons[index]) {
            currentGamepadActions.add(bindings.gamepad.buttons[index]);
          }
        });

        // 触发手柄动作
        currentGamepadActions.forEach(action => triggerAction(action, 'controller', now));
      }

      // 2. 处理键盘输入（基于 activeKeys 集合，而非依赖系统的 keydown repeat）
      const currentKeyboardActions = new Set<InputAction>();
      activeKeys.current.forEach(key => {
        const action = bindings.keyboard[key];
        if (action) currentKeyboardActions.add(action);
      });
      currentKeyboardActions.forEach(action => triggerAction(action, 'keyboard', now));

      // 3. 清理已经松开的动作
      activeActions.current.forEach((_, action) => {
        if (!currentGamepadActions.has(action) && !currentKeyboardActions.has(action)) {
          activeActions.current.delete(action);
        }
      });

      requestRef.current = requestAnimationFrame(loop);
    };

    // 键盘物理按键状态同步
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      onModeChange('keyboard');
      activeKeys.current.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.key);
    };

    // 鼠标模式切换
    const handleMouse = () => {
      // 当使用鼠标时，清空长按状态防卡死
      activeActions.current.clear();
      activeKeys.current.clear();
      onModeChange('mouse');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('mousedown', handleMouse, { passive: true });
    
    // 启动统一轮询
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mousedown', handleMouse);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onModeChange, bindings]);
};