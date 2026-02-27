// src/ui/focus/FocusProvider.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';

export type InputMode = "mouse" | "keyboard" | "controller";

interface GlobalFocusContextType {
  inputMode: InputMode;
}

// 1. 创建全局输入模式 Context
const GlobalFocusContext = createContext<GlobalFocusContextType>({ inputMode: 'mouse' });

export const useInputMode = () => useContext(GlobalFocusContext).inputMode;

interface FocusProviderProps {
  children: React.ReactNode;
  debug?: boolean;
}

export const FocusProvider: React.FC<FocusProviderProps> = ({ children, debug = false }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('mouse');
  
  // 使用 ref 避免在事件监听器中产生闭包陷阱
  const currentModeRef = useRef<InputMode>('mouse');

  useEffect(() => {
    init({
      debug: debug,
      visualDebug: debug,
    });
    setIsInitialized(true);
  }, [debug]);

  // 2. 核心：全局监听用户的输入设备并切换状态
  useEffect(() => {
    const updateMode = (mode: InputMode) => {
      if (currentModeRef.current !== mode) {
        currentModeRef.current = mode;
        setInputMode(mode);
        // 可选：将模式注入到 body class，方便纯 CSS 使用 (如 .intent-mouse)
        document.body.classList.remove('intent-mouse', 'intent-keyboard', 'intent-controller');
        document.body.classList.add(`intent-${mode}`);
      }
    };

    const handleMouseMove = () => updateMode('mouse');
    const handleMouseDown = () => updateMode('mouse');
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略单纯的修饰键，避免误触发
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      updateMode('keyboard');
    };

    const handleGamepad = () => updateMode('controller');

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('gamepadconnected', handleGamepad);
    // 监听手柄按键 (如果有更高级的 Gamepad API 轮询也可以写在这里)
    window.addEventListener('gamepadbuttondown', handleGamepad as EventListener); 

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('gamepadconnected', handleGamepad);
      window.removeEventListener('gamepadbuttondown', handleGamepad as EventListener);
    };
  }, []);

  if (!isInitialized) return null;

  return (
    <GlobalFocusContext.Provider value={{ inputMode }}>
      {children}
    </GlobalFocusContext.Provider>
  );
};