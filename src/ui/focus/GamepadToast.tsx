// src/ui/focus/GamepadToast.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Gamepad2 } from 'lucide-react';

interface OreGamepadConnectedDetail {
  id?: string;
}

export const GamepadToast: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isSteamDeck, setIsSteamDeck] = useState(false);

  useEffect(() => {
    // 统一通过 InputDriver 派发的 ore-gamepad-connected 事件来感知手柄连接
    const handleOreGamepadConnected = async (e: Event) => {
      const custom = e as CustomEvent<OreGamepadConnectedDetail>;
      console.log('Gamepad Connected via InputDriver:', custom.detail?.id);

      try {
        const isDeck = await invoke<boolean>('check_steam_deck');
        setIsSteamDeck(isDeck);
      } catch (err) {
        console.error('SteamDeck 检测失败:', err);
      }

      setShow(true);
      setTimeout(() => setShow(false), 3000);
    };

    window.addEventListener('ore-gamepad-connected', handleOreGamepadConnected as EventListener);

    // 打开时如果已经有手柄连接，由 InputDriver 的轮询逻辑触发一次 ore-gamepad-connected

    return () => {
      window.removeEventListener('ore-gamepad-connected', handleOreGamepadConnected as EventListener);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-10 left-2/3 -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-none"
        >
          {/* Xbox / Steam Deck 风格的成就弹窗 */}
          <div className={`
            flex items-center px-6 py-3 rounded-full bg-[#1E1E1F] border-2 shadow-2xl
            ${isSteamDeck
              ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]' // Steam Deck 专属蓝色霓虹发光
              : 'border-ore-green shadow-[0_0_20px_rgba(56,133,39,0.4)]'   // 普通手柄绿色发光
            }
          `}>
            <div className={`mr-4 p-2 rounded-full ${isSteamDeck ? 'bg-blue-500/20 text-blue-400' : 'bg-ore-green/20 text-ore-green'}`}>
              <Gamepad2 size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-minecraft text-lg leading-tight">
                {isSteamDeck ? 'SteamDeck 掌机' : '控制器已连接'}
              </span>
              <span className="text-[#A0A0A0] font-minecraft text-xs">
                {isSteamDeck ? '已自动适配掌机输入模式' : '已自动开启空间导航体验'}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};