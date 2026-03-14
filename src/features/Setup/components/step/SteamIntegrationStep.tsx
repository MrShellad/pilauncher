// src/features/Setup/components/step/SteamIntegrationStep.tsx
import React from 'react';
import { Gamepad2, Play } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';

interface SteamIntegrationStepProps {
  onSkip: () => void;
  onRegister: () => void;
  onFinish: () => void;
  isRegistering: boolean;
  registerSuccess: boolean;
  registerError: string | null;
  isGamepadMode: boolean;
  setGamepadModeSettings: () => void;
}

export const SteamIntegrationStep: React.FC<SteamIntegrationStepProps> = ({
  onSkip, onRegister, onFinish, isRegistering, registerSuccess, registerError, isGamepadMode, setGamepadModeSettings
}) => {
  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 blur-3xl pointer-events-none" />
      <Gamepad2 size={48} className="text-blue-400 mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">Steam 库集成</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        检测到您的系统的 Steam。<br />
        是否将 PiLauncher 注册为 Steam 非 Steam 游戏，以便在库或大屏幕模式中直接启动？
      </p>

      {registerSuccess ? (
        <div className="w-full flex flex-col items-center">
          <p className="text-green-400 text-sm mb-4">注册成功！请重启 Steam 使快捷方式生效。</p>
          {isGamepadMode && (
            <div className="bg-ore-gray-surface p-4 mb-4 rounded-md border border-ore-gray-border">
              <p className="text-ore-text-muted text-sm mb-3 text-center">
                检测到您当前处于游戏模式，是否默认进入全屏 (Gamepad) 模式启动并在手柄UI关闭时退出程序？
              </p>
              <OreButton focusKey="setup-btn-gamepad-mode" onClick={() => { setGamepadModeSettings(); onFinish(); }} variant="primary" className="w-full bg-blue-600 mb-2">
                开启全屏并完成
              </OreButton>
            </div>
          )}
          <OreButton focusKey="setup-btn-finish" onClick={onFinish} variant="ghost" className="w-full mt-2">
            直接完成
          </OreButton>
        </div>
      ) : (
        <div className="flex w-full space-x-3 relative z-10">
          <OreButton focusKey="setup-btn-steam-skip" onClick={onSkip} variant="ghost" size="auto" className="flex-1" disabled={isRegistering}>
            不需要，跳过
          </OreButton>
          <OreButton focusKey="setup-btn-steam-register" onClick={onRegister} variant="primary" size="auto" className="flex-1 bg-blue-600 hover:bg-blue-500 !border-blue-700">
            <Play size={16} className="mr-2" /> {isRegistering ? "注册中..." : "注册到 Steam"}
          </OreButton>
        </div>
      )}

      {registerError && (
        <p className="text-red-400 text-xs mt-4 text-center w-full relative z-10 bg-red-500/10 p-2 rounded">{registerError}</p>
      )}
    </>
  );
};
