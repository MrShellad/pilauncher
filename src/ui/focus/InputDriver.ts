// /src/ui/focus/InputDriver.ts
import { useEffect, useRef } from 'react';

export type InputAction = 
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' 
  | 'CONFIRM' | 'CANCEL' 
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT';

export type InputMode = "mouse" | "keyboard" | "controller";

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
    const keyMap: Record<string, string> = {
      'UP': 'ArrowUp', 'DOWN': 'ArrowDown', 'LEFT': 'ArrowLeft', 'RIGHT': 'ArrowRight',
      'CONFIRM': 'Enter', 'CANCEL': 'Escape'
    };
    if (keyMap[action]) {
      const target = document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: keyMap[action], bubbles: true, cancelable: true }));
    }
  }
};

export const useInputDriver = (onModeChange: (mode: InputMode) => void) => {
  const lastButtons = useRef<boolean[]>(new Array(20).fill(false));
  const lastAxes = useRef<{ x: boolean, y: boolean }>({ x: false, y: false });
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const pollGamepad = () => {
      const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
      if (gp) {
        const currentAxisX = Math.abs(gp.axes[0]) > 0.5;
        const currentAxisY = Math.abs(gp.axes[1]) > 0.5;

        if (currentAxisX && !lastAxes.current.x) {
          onModeChange('controller');
          dispatchAction(gp.axes[0] > 0 ? 'RIGHT' : 'LEFT', 'controller');
        }
        if (currentAxisY && !lastAxes.current.y) {
          onModeChange('controller');
          dispatchAction(gp.axes[1] > 0 ? 'DOWN' : 'UP', 'controller');
        }
        lastAxes.current = { x: currentAxisX, y: currentAxisY };

        // ✅ 核心修改：增加了 6(LT), 7(RT) 扳机键的映射。4(LB), 5(RB) 依然保留作为备选习惯
        const mapping: Record<number, InputAction> = {
          0: 'CONFIRM', 1: 'CANCEL', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
          4: 'PAGE_LEFT', 5: 'PAGE_RIGHT', 
          6: 'PAGE_LEFT', 7: 'PAGE_RIGHT', // 扳机键支持
          9: 'MENU', 8: 'VIEW'
        };

        gp.buttons.forEach((button, index) => {
          const isPressed = button.pressed;
          if (isPressed && !lastButtons.current[index]) {
            onModeChange('controller');
            if (mapping[index]) dispatchAction(mapping[index], 'controller');
          }
          lastButtons.current[index] = isPressed;
        });
      }
      requestRef.current = requestAnimationFrame(pollGamepad);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return; 
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      
      onModeChange('keyboard');
      
      switch(e.key) {
        case 'ArrowUp': dispatchAction('UP', 'keyboard'); break;
        case 'ArrowDown': dispatchAction('DOWN', 'keyboard'); break;
        case 'ArrowLeft': dispatchAction('LEFT', 'keyboard'); break;
        case 'ArrowRight': dispatchAction('RIGHT', 'keyboard'); break;
        case 'Enter': dispatchAction('CONFIRM', 'keyboard'); break;
        case 'Escape': dispatchAction('CANCEL', 'keyboard'); break;
        // ✅ 核心修改：捕获 [ ] 键
        case '[': dispatchAction('PAGE_LEFT', 'keyboard'); break;
        case ']': dispatchAction('PAGE_RIGHT', 'keyboard'); break;
      }
    };

    const handleMouse = () => onModeChange('mouse');

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