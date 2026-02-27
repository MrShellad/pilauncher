// src/ui/focus/InputDriver.ts
import { useEffect, useRef } from 'react';

// ================= 1. 定义统一的语义化 Action =================
export type InputAction = 
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' 
  | 'CONFIRM' | 'CANCEL' 
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT';

export type InputMode = "mouse" | "keyboard" | "controller";

// ================= 2. 全局 Action 广播中心 =================
// 供业务组件调用的 Hook：只订阅 Action，不关心物理按键
export const useInputAction = (action: InputAction, callback: () => void) => {
  useEffect(() => {
    const handler = (e: CustomEvent<InputAction>) => {
      if (e.detail === action) callback();
    };
    window.addEventListener('ore-action', handler as EventListener);
    return () => window.removeEventListener('ore-action', handler as EventListener);
  }, [action, callback]);
};

// 内部派发函数
const dispatchAction = (action: InputAction) => {
  window.dispatchEvent(new CustomEvent('ore-action', { detail: action }));
  
  // 【兼容层】：为了让 Norigin Spatial Navigation 继续完美工作，
  // 我们将标准方向和确认键同步派发为原生 KeyboardEvent
  const keyMap: Record<string, string> = {
    'UP': 'ArrowUp', 'DOWN': 'ArrowDown', 'LEFT': 'ArrowLeft', 'RIGHT': 'ArrowRight',
    'CONFIRM': 'Enter', 'CANCEL': 'Escape'
  };
  if (keyMap[action]) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: keyMap[action], bubbles: true }));
  }
};

// ================= 3. 核心驱动 Hook =================
export const useInputDriver = (onModeChange: (mode: InputMode) => void) => {
  // 记录上一帧的按键状态，用于【边沿检测】
  const lastButtons = useRef<boolean[]>(new Array(20).fill(false));
  const lastAxes = useRef<{ x: boolean, y: boolean }>({ x: false, y: false });
  
  // ✅ 修复：给 useRef 传入初始值 0，解决 TypeScript 报错
  const requestRef = useRef<number>(0);

  useEffect(() => {
    // ---------------- A. 轮询 Gamepad (边沿检测) ----------------
    const pollGamepad = () => {
      const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
      if (gp) {
        // 1. 摇杆模拟 (设置 0.5 的死区防漂移)
        const currentAxisX = Math.abs(gp.axes[0]) > 0.5;
        const currentAxisY = Math.abs(gp.axes[1]) > 0.5;

        // 摇杆 X 轴边沿检测
        if (currentAxisX && !lastAxes.current.x) {
          onModeChange('controller');
          dispatchAction(gp.axes[0] > 0 ? 'RIGHT' : 'LEFT');
        }
        // 摇杆 Y 轴边沿检测
        if (currentAxisY && !lastAxes.current.y) {
          onModeChange('controller');
          dispatchAction(gp.axes[1] > 0 ? 'DOWN' : 'UP');
        }
        lastAxes.current = { x: currentAxisX, y: currentAxisY };

        // 2. 实体按键映射与边沿检测 (Rising Edge)
        const mapping: Record<number, InputAction> = {
          0: 'CONFIRM',    // A
          1: 'CANCEL',     // B
          12: 'UP',        // D-pad Up
          13: 'DOWN',      // D-pad Down
          14: 'LEFT',      // D-pad Left
          15: 'RIGHT',     // D-pad Right
          4: 'PAGE_LEFT',  // LB
          5: 'PAGE_RIGHT', // RB
          9: 'MENU',       // Start/Menu
          8: 'VIEW',       // Select/View
        };

        gp.buttons.forEach((button, index) => {
          const isPressed = button.pressed;
          // 仅在从 false 变为 true 的瞬间触发！
          if (isPressed && !lastButtons.current[index]) {
            onModeChange('controller');
            if (mapping[index]) dispatchAction(mapping[index]);
          }
          lastButtons.current[index] = isPressed;
        });
      }
      requestRef.current = requestAnimationFrame(pollGamepad);
    };

    // ---------------- B. 监听 Keyboard ----------------
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return; // 忽略我们自己代码派发的事件
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      
      onModeChange('keyboard');
      
      // 键盘映射到统一 Action
      switch(e.key) {
        case 'ArrowUp': dispatchAction('UP'); break;
        case 'ArrowDown': dispatchAction('DOWN'); break;
        case 'ArrowLeft': dispatchAction('LEFT'); break;
        case 'ArrowRight': dispatchAction('RIGHT'); break;
        case 'Enter': dispatchAction('CONFIRM'); break;
        case 'Escape': dispatchAction('CANCEL'); break;
      }
    };

    // ---------------- C. 监听 Mouse ----------------
    const handleMouse = () => onModeChange('mouse');

    // 启动监听
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('mousedown', handleMouse, { passive: true });
    requestRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mousedown', handleMouse);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onModeChange]);
};