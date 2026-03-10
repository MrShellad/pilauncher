import React from 'react';
import { Gamepad2, Download } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useGamepadModStore } from '../../../store/useGamepadModStore';

export const GamepadModPrompt: React.FC = () => {
  const { isOpen, modInfo, resolvePrompt } = useGamepadModStore();

  if (!isOpen || !modInfo) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={() => resolvePrompt(false)}
      title="检测到缺少手柄支持"
      className="w-[500px]"
      actions={
        <>
          <OreButton
            focusKey="gamepad-prompt-btn-cancel"
            variant="secondary"
            onClick={() => resolvePrompt(false)}
            className="flex-1"
          >
            忽略并继续启动
          </OreButton>
          <OreButton
            focusKey="gamepad-prompt-btn-download"
            variant="primary"
            onClick={() => resolvePrompt(true)}
            className="flex-1"
          >
            <Download size={16} className="mr-2" />
            一键下载并安装
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-20 h-20 rounded-full bg-ore-accent/10 flex items-center justify-center mb-6">
          <Gamepad2 size={40} className="text-ore-accent" />
        </div>
        <h3 className="text-white text-xl font-bold mb-3 font-minecraft tracking-wide">
          推荐安装手柄支持模块
        </h3>
        <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
          PiLauncher 检测到当前实例尚未安装手柄支持功能！为了获得最佳的游玩体验，我们强烈建议您安装适用于当前版本的 <span className="text-ore-accent">"{modInfo.name}"</span>。
        </p>
        <div className="bg-[#18181A] border border-[#2A2A2C] rounded-md px-4 py-3 w-4/5 flex items-center justify-between">
          <span className="text-gray-400 font-minecraft">目标文件</span>
          <span className="text-gray-200 font-minecraft truncate max-w-[200px]" title={modInfo.fileName}>{modInfo.fileName}</span>
        </div>
      </div>
    </OreModal>
  );
};
