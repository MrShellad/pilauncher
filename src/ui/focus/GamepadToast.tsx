// src/ui/focus/GamepadToast.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Gamepad2 } from 'lucide-react';

export const GamepadToast: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isSteamDeck, setIsSteamDeck] = useState(false);

  useEffect(() => {
    // 监听手柄插入事件
    const handleGamepadConnected = async (e: GamepadEvent) => {
      console.log("Gamepad Connected:", e.gamepad.id);
      
      try {
        // 调用 Rust 后端识别是否为 Steam Deck
        const isDeck = await invoke<boolean>('check_steam_deck');
        setIsSteamDeck(isDeck);
      } catch (err) {
        console.error("SteamDeck 检测失败:", err);
      }
      
      setShow(true);
      // 3秒后自动隐藏成就
      setTimeout(() => setShow(false), 3000);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);

    // 如果应用刚打开时手柄已经连着了，手动触发一次
    if (navigator.getGamepads && navigator.getGamepads().filter(Boolean).length > 0) {
      handleGamepadConnected({ gamepad: navigator.getGamepads()[0] } as GamepadEvent);
    }

    return () => window.removeEventListener('gamepadconnected', handleGamepadConnected);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
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