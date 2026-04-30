import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useGameLogStore } from '../../store/useGameLogStore';

export type InputAction =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'CONFIRM' | 'CANCEL'
  | 'MENU' | 'VIEW' | 'PAGE_LEFT' | 'PAGE_RIGHT'
  | 'TAB_LEFT' | 'TAB_RIGHT'
  | 'ACTION_X' | 'ACTION_Y';

export type InputMode = 'mouse' | 'keyboard' | 'controller';

type AxisMapping = { negative: InputAction; positive: InputAction };

export interface InputBindings {
  keyboard: Record<string, InputAction>;
  gamepad: {
    buttons: Record<string | number, InputAction>;
    axes: Record<string | number, AxisMapping>;
  };
  controllerKeyboard?: Record<string, InputAction>;
  mouse?: {
    buttons?: Record<number, InputAction>;
    wheel?: {
      up?: InputAction;
      down?: InputAction;
    };
  };
}

export const defaultBindings: InputBindings = {
  keyboard: {
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    Enter: 'CONFIRM',
    Escape: 'CANCEL',
    ';': 'PAGE_LEFT',
    "'": 'PAGE_RIGHT',
    '[': 'TAB_LEFT',
    ']': 'TAB_RIGHT',
    x: 'ACTION_X',
    y: 'ACTION_Y',
  },
  gamepad: {
    buttons: {
      South: 'CONFIRM',
      East: 'CANCEL',
      North: 'ACTION_Y',
      West: 'ACTION_X',
      LeftTrigger: 'TAB_LEFT',
      LeftTrigger2: 'PAGE_LEFT',
      RightTrigger: 'TAB_RIGHT',
      RightTrigger2: 'PAGE_RIGHT',
      Select: 'VIEW',
      Start: 'MENU',
      DPadUp: 'UP',
      DPadDown: 'DOWN',
      DPadLeft: 'LEFT',
      DPadRight: 'RIGHT',
      0: 'CONFIRM',
      1: 'CANCEL',
      2: 'ACTION_Y',
      3: 'ACTION_X',
      6: 'TAB_LEFT',
      7: 'PAGE_LEFT',
      8: 'TAB_RIGHT',
      9: 'PAGE_RIGHT',
      10: 'VIEW',
      11: 'MENU',
      16: 'UP',
      17: 'DOWN',
      18: 'LEFT',
      19: 'RIGHT',
    },
    axes: {
      LeftStickX: { negative: 'LEFT', positive: 'RIGHT' },
      LeftStickY: { negative: 'DOWN', positive: 'UP' },
      0: { negative: 'LEFT', positive: 'RIGHT' },
      1: { negative: 'DOWN', positive: 'UP' },
    },
  },
};

export const steamDeckKeyboardPreset: Pick<InputBindings, 'controllerKeyboard' | 'mouse'> = {
  controllerKeyboard: {
    w: 'UP',
    W: 'UP',
    s: 'DOWN',
    S: 'DOWN',
    a: 'LEFT',
    A: 'LEFT',
    d: 'RIGHT',
    D: 'RIGHT',
    ' ': 'CONFIRM',
    Space: 'CONFIRM',
    Enter: 'CONFIRM',
    Escape: 'CANCEL',
    f: 'ACTION_Y',
    F: 'ACTION_Y',
  },
  mouse: {
    buttons: {
      2: 'ACTION_X',
    },
    wheel: {
      up: 'UP',
      down: 'DOWN',
    },
  },
};

const REPEAT_DELAY = 300;
const REPEAT_RATE = 50;
const AXIS_DEADZONE = 0.5;
const MOUSE_THRESHOLD = 5;

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

const dispatchAction = (
  action: InputAction,
  bindings: InputBindings,
  source: InputMode = 'controller',
) => {
  window.dispatchEvent(new CustomEvent('ore-action', { detail: action }));

  if (source === 'controller') {
    const key = Object.keys(bindings.keyboard).find((item) => bindings.keyboard[item] === action);
    if (key) {
      const target = document.activeElement || document.body;
      const eventProps = getKeyEventProps(key);
      const event = new KeyboardEvent('keydown', {
        ...eventProps,
        bubbles: true,
        cancelable: true,
        composed: true,
      });

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
  bindings: InputBindings = defaultBindings,
) => {
  const activeActions = useRef<Map<InputAction, { start: number; lastFire: number }>>(new Map());
  const requestRef = useRef<number>(0);
  const activeKeys = useRef<Map<string, InputMode>>(new Map());
  const activeMouseButtons = useRef<Map<number, InputMode>>(new Map());

  const nativeButtonsRef = useRef<Set<string | number>>(new Set());
  const nativeAxesRef = useRef<Record<string | number, number>>({});
  const lastAxisActionRef = useRef<Record<string | number, string>>({});

  const triggerAction = (
    action: InputAction,
    mode: InputMode,
    now: number,
    activeBindings: InputBindings,
  ) => {
    const record = activeActions.current.get(action);
    if (!record) {
      onModeChange(mode);
      dispatchAction(action, activeBindings, mode);
      activeActions.current.set(action, { start: now, lastFire: now });
      return;
    }

    if (now - record.start > REPEAT_DELAY && now - record.lastFire > REPEAT_RATE) {
      dispatchAction(action, activeBindings, mode);
      record.lastFire = now;
    }
  };

  useEffect(() => {
    const loop = (now: number) => {
      const currentGamepadActions = new Set<InputAction>();
      const { gameState } = useGameLogStore.getState();

      if (gameState === 'running' || gameState === 'launching') {
        nativeButtonsRef.current.clear();
        nativeAxesRef.current = {};
        lastAxisActionRef.current = {};
        activeMouseButtons.current.clear();
      } else {
        nativeButtonsRef.current.forEach((id) => {
          const action = (bindings.gamepad.buttons as any)[id];
          if (action) currentGamepadActions.add(action);
        });

        Object.entries(bindings.gamepad.axes).forEach(([id, mapping]) => {
          const value = nativeAxesRef.current[id] ?? 0;
          if (value < -AXIS_DEADZONE) currentGamepadActions.add(mapping.negative);
          else if (value > AXIS_DEADZONE) currentGamepadActions.add(mapping.positive);
        });

        currentGamepadActions.forEach((action) =>
          triggerAction(action, 'controller', now, bindings),
        );
      }

      const currentKeyboardActions = new Map<InputAction, InputMode>();
      activeKeys.current.forEach((mode, key) => {
        const action = mode === 'controller'
          ? bindings.controllerKeyboard?.[key]
          : bindings.keyboard[key];
        if (action) currentKeyboardActions.set(action, mode);
      });
      currentKeyboardActions.forEach((mode, action) =>
        triggerAction(action, mode, now, bindings),
      );

      const currentMouseActions = new Map<InputAction, InputMode>();
      activeMouseButtons.current.forEach((mode, button) => {
        const action = bindings.mouse?.buttons?.[button];
        if (action) currentMouseActions.set(action, mode);
      });
      currentMouseActions.forEach((mode, action) =>
        triggerAction(action, mode, now, bindings),
      );

      activeActions.current.forEach((_, action) => {
        if (
          !currentGamepadActions.has(action) &&
          !currentKeyboardActions.has(action) &&
          !currentMouseActions.has(action)
        ) {
          activeActions.current.delete(action);
        }
      });

      requestRef.current = requestAnimationFrame(loop);
    };

    const resolveKeyboardBinding = (e: KeyboardEvent) => {
      const candidates = [e.key, e.code].filter(Boolean);
      const controllerKey = candidates.find((key) => bindings.controllerKeyboard?.[key]);
      if (controllerKey) return { key: controllerKey, mode: 'controller' as InputMode };
      const keyboardKey = candidates.find((key) => bindings.keyboard[key]);
      if (keyboardKey) return { key: keyboardKey, mode: 'keyboard' as InputMode };
      return { key: e.key, mode: 'keyboard' as InputMode };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const binding = resolveKeyboardBinding(e);
      onModeChange(binding.mode);
      activeKeys.current.set(binding.key, binding.mode);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.key);
      if (e.code) activeKeys.current.delete(e.code);
    };

    let lastMousePos = { x: 0, y: 0 };
    const handleMouse = (e: MouseEvent) => {
      const dx = Math.abs(e.screenX - lastMousePos.x);
      const dy = Math.abs(e.screenY - lastMousePos.y);
      if (dx < MOUSE_THRESHOLD && dy < MOUSE_THRESHOLD) return;

      lastMousePos = { x: e.screenX, y: e.screenY };
      activeActions.current.clear();
      activeKeys.current.clear();
      activeMouseButtons.current.clear();
      onModeChange('mouse');
    };

    const handleMouseDown = (e: MouseEvent) => {
      lastMousePos = { x: e.screenX, y: e.screenY };
      const action = bindings.mouse?.buttons?.[e.button];
      if (action) {
        activeMouseButtons.current.set(e.button, 'controller');
        onModeChange('controller');
        if (e.button === 2) e.preventDefault();
        return;
      }
      handleMouse(e);
    };

    const handleMouseUp = (e: MouseEvent) => {
      activeMouseButtons.current.delete(e.button);
    };

    const handleWheel = (e: WheelEvent) => {
      const action = e.deltaY < 0 ? bindings.mouse?.wheel?.up : bindings.mouse?.wheel?.down;
      if (!action) return;
      onModeChange('controller');
      dispatchAction(action, bindings, 'controller');
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (bindings.mouse?.buttons?.[2]) e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('contextmenu', handleContextMenu);

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
        if (DEBUG_GAMEPAD) console.log(`[Gamepad] connected: native-${event.payload.id}`);
        window.dispatchEvent(
          new CustomEvent('ore-gamepad-connected', { detail: { id: `native-${event.payload.id}` } }),
        );
        return;
      }

      if (kind === 'Disconnected') {
        if (DEBUG_GAMEPAD) console.log('[Gamepad] disconnected');
        nativeButtonsRef.current.clear();
        nativeAxesRef.current = {};
        lastAxisActionRef.current = {};
        return;
      }

      if (button_name || typeof button_code === 'number') {
        const name = button_name || 'unknown';
        const code = Number(button_code);
        const isPressed =
          kind === 'ButtonPressed' ||
          (kind === 'ButtonChanged' && (axis_value || 0) > 0.5);
        const isReleased =
          kind === 'ButtonReleased' ||
          (kind === 'ButtonChanged' && (axis_value || 0) < 0.2);

        if (isPressed) {
          const actionByName =
            name !== 'unknown' ? (bindings.gamepad.buttons as any)[name] : undefined;
          const actionByCode =
            typeof button_code === 'number' ? (bindings.gamepad.buttons as any)[code] : undefined;

          if (actionByName && actionByCode && actionByName !== actionByCode) {
            nativeButtonsRef.current.add(name);
          } else if (actionByName) {
            nativeButtonsRef.current.add(name);
          } else if (actionByCode) {
            nativeButtonsRef.current.add(code);
          } else {
            if (name !== 'unknown') nativeButtonsRef.current.add(name);
            if (typeof button_code === 'number') nativeButtonsRef.current.add(code);
          }

          if (DEBUG_GAMEPAD) {
            const action = actionByName || actionByCode;
            console.log(`[Gamepad] button down ${name}(${code}) => ${action}`);
          }
        } else if (isReleased) {
          if (name !== 'unknown') nativeButtonsRef.current.delete(name);
          if (typeof button_code === 'number') nativeButtonsRef.current.delete(code);
        }
      }

      if (
        kind === 'AxisChanged' &&
        (axis_name || typeof axis_code === 'number') &&
        typeof axis_value === 'number'
      ) {
        const name = axis_name || 'unknown';
        const code = Number(axis_code);
        const mappingByName =
          name !== 'unknown' ? (bindings.gamepad.axes as any)[name] : undefined;
        const mappingByCode =
          typeof axis_code === 'number' ? (bindings.gamepad.axes as any)[code] : undefined;

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
    }).then((fn) => { unlistenNative = fn; });

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (unlistenNative) unlistenNative();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onModeChange, bindings]);
};
