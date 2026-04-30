import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { invoke } from '@tauri-apps/api/core';

import {
  useInputDriver,
  type InputMode,
  type InputBindings,
  defaultBindings,
  steamDeckKeyboardPreset,
} from './InputDriver';
import { GamepadToast } from './GamepadToast';
import { useSettingsStore } from '../../store/useSettingsStore';

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
  const [savedBindings, setSavedBindings] = useState<Partial<InputBindings> | null>(null);
  const steamDeckKeymapEnabled = useSettingsStore(
    (state) => state.settings.game?.steamDeckKeymap ?? false,
  );

  const currentModeRef = useRef<InputMode>('mouse');

  useEffect(() => {
    const setupEngine = async () => {
      try {
        const loadedBindings = await invoke<Partial<InputBindings>>('get_keybindings');
        if (loadedBindings && Object.keys(loadedBindings).length > 0) {
          setSavedBindings(loadedBindings);
        }
      } catch (err) {
        console.error('Failed to load keybindings, using defaults', err);
      }

      init({ debug, visualDebug: debug });
      setIsInitialized(true);
    };

    void setupEngine();
  }, [debug]);

  const activeBindings = useMemo<InputBindings>(() => {
    const merged: InputBindings = {
      keyboard: {
        ...defaultBindings.keyboard,
        ...(savedBindings?.keyboard || {}),
      },
      gamepad: {
        buttons: {
          ...defaultBindings.gamepad.buttons,
          ...(savedBindings?.gamepad?.buttons || {}),
        },
        axes: {
          ...defaultBindings.gamepad.axes,
          ...(savedBindings?.gamepad?.axes || {}),
        },
      },
    };

    if (steamDeckKeymapEnabled) {
      merged.controllerKeyboard = {
        ...steamDeckKeyboardPreset.controllerKeyboard,
        ...(savedBindings?.controllerKeyboard || {}),
      };
      merged.mouse = {
        buttons: {
          ...(steamDeckKeyboardPreset.mouse?.buttons || {}),
          ...(savedBindings?.mouse?.buttons || {}),
        },
        wheel: {
          ...(steamDeckKeyboardPreset.mouse?.wheel || {}),
          ...(savedBindings?.mouse?.wheel || {}),
        },
      };
    } else if (savedBindings?.controllerKeyboard || savedBindings?.mouse) {
      merged.controllerKeyboard = savedBindings.controllerKeyboard;
      merged.mouse = savedBindings.mouse;
    }

    return merged;
  }, [savedBindings, steamDeckKeymapEnabled]);

  const updateMode = useCallback((mode: InputMode) => {
    if (currentModeRef.current !== mode) {
      currentModeRef.current = mode;
      setInputMode(mode);
      document.body.classList.remove('intent-mouse', 'intent-keyboard', 'intent-controller');
      document.body.classList.add(`intent-${mode}`);
    }
  }, []);

  useInputDriver(updateMode, activeBindings);

  if (!isInitialized) return null;

  return (
    <GlobalFocusContext.Provider value={{ inputMode }}>
      {children}
      <GamepadToast />
    </GlobalFocusContext.Provider>
  );
};
