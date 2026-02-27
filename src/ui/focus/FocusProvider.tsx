// src/ui/focus/FocusProvider.tsx
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';

// 引入全新设计的超级输入驱动和成就弹窗组件
import { useInputDriver, type InputMode } from './InputDriver';
import { GamepadToast } from './GamepadToast';

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
  
  // 使用 ref 避免在事件回调中产生闭包陷阱
  const currentModeRef = useRef<InputMode>('mouse');

  // 2. 初始化空间导航引擎
  useEffect(() => {
    init({
      debug: debug,
      visualDebug: debug,
    });
    setIsInitialized(true);
  }, [debug]);

  // 3. 全局模式切换方法
  const updateMode = useCallback((mode: InputMode) => {
    if (currentModeRef.current !== mode) {
      currentModeRef.current = mode;
      setInputMode(mode);
      // 将模式注入到 body class，方便纯 CSS 使用 (如 .intent-mouse)
      document.body.classList.remove('intent-mouse', 'intent-keyboard', 'intent-controller');
      document.body.classList.add(`intent-${mode}`);
    }
  }, []);

  // 4. 挂载底层超级驱动，接管所有输入设备的识别与转化
  useInputDriver(updateMode);

  // 如果引擎还没初始化完毕，先不渲染子树
  if (!isInitialized) return null;

  return (
    <GlobalFocusContext.Provider value={{ inputMode }}>
      {children}
      
      {/* 5. 挂载全局游戏手柄成就提示吐司 */}
      <GamepadToast />
    </GlobalFocusContext.Provider>
  );
};