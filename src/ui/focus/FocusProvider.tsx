// src/ui/focus/FocusProvider.tsx
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { invoke } from '@tauri-apps/api/core';

import { useInputDriver, type InputMode, defaultBindings } from './InputDriver';
import { GamepadToast } from './GamepadToast';

interface GlobalFocusContextType {
  inputMode: InputMode;
}

const GlobalFocusContext = createContext<GlobalFocusContextType>({ inputMode: 'mouse' });
export const useInputMode = () => useContext(GlobalFocusContext).inputMode;

interface FocusProviderProps {
  children: React.ReactNode;
  debug?: boolean;
}

export const FocusProvider: React.FC<FocusProviderProps> = ({ children, debug = false }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('mouse');
  const [activeBindings, setActiveBindings] = useState(defaultBindings);
  
  const currentModeRef = useRef<InputMode>('mouse');

  useEffect(() => {
    // 异步加载流程：读取按键映射 -> 初始化焦点引擎
    const setupEngine = async () => {
      try {
        const savedBindings = await invoke<any>('get_keybindings');
        
        // 如果后端返回了有效的配置（不是空对象），则进行合并或替换
        if (savedBindings && Object.keys(savedBindings).length > 0) {
          // 这里做一个简单的合并，防止后端 json 缺少某些必须的键
          setActiveBindings((prev) => ({
            keyboard: { ...prev.keyboard, ...savedBindings.keyboard },
            gamepad: {
              buttons: { ...prev.gamepad.buttons, ...savedBindings.gamepad?.buttons },
              axes: { ...prev.gamepad.axes, ...savedBindings.gamepad?.axes }
            }
          }));
        }
      } catch (err) {
        console.error("加载按键映射失败，使用默认配置:", err);
      }

      // 初始化空间导航引擎
      init({ debug, visualDebug: debug });
      setIsInitialized(true);
    };

    setupEngine();
  }, [debug]);

  const updateMode = useCallback((mode: InputMode) => {
    if (currentModeRef.current !== mode) {
      currentModeRef.current = mode;
      setInputMode(mode);
      document.body.classList.remove('intent-mouse', 'intent-keyboard', 'intent-controller');
      document.body.classList.add(`intent-${mode}`);
    }
  }, []);

  // 挂载底层超级驱动，并传入动态加载的按键映射
  useInputDriver(updateMode, activeBindings);

  // 如果引擎还没初始化完毕，展示黑屏或 loading
  if (!isInitialized) return null;

  return (
    <GlobalFocusContext.Provider value={{ inputMode }}>
      {children}
      <GamepadToast />
    </GlobalFocusContext.Provider>
  );
};