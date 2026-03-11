import React, { useState, useEffect } from 'react';
import { Gamepad2, Download } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useGamepadModStore } from '../../../store/useGamepadModStore';
import { FocusItem } from '../../../ui/focus/FocusItem';

export const GamepadModPrompt: React.FC = () => {
  const { isOpen, modInfos, resolvePrompt } = useGamepadModStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen || !modInfos || modInfos.length === 0) return null;

  const currentMod = modInfos[selectedIndex];
  const hasMultiple = modInfos.length > 1;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={() => resolvePrompt(null)}
      title="检测到缺少手柄支持"
      className="w-[500px]"
      actions={
        <>
          <OreButton
            focusKey="gamepad-prompt-btn-cancel"
            variant="secondary"
            onClick={() => resolvePrompt(null)}
            className="flex-1"
          >
            忽略并继续启动
          </OreButton>
          <OreButton
            focusKey="gamepad-prompt-btn-download"
            variant="primary"
            onClick={() => resolvePrompt(currentMod)}
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
        
        {hasMultiple ? (
          <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
            PiLauncher 检测到当前实例尚未安装手柄支持功能！我们为您找到了多个适用的选择，请选择：
          </p>
        ) : (
          <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
            PiLauncher 检测到当前实例尚未安装手柄支持功能！为了获得最佳的游玩体验，我们强烈建议您安装适用于当前版本的 <span className="text-ore-accent">"{currentMod.name}"</span>。
          </p>
        )}

        {hasMultiple ? (
          <div className="w-4/5 flex flex-col gap-2">
            {modInfos.map((info, idx) => (
              <FocusItem key={info.id} focusKey={`gamepad-mod-${info.id}`} onEnter={() => setSelectedIndex(idx)}>
                {({ ref, focused }) => (
                  <button
                    ref={ref}
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-4 py-3 rounded-md border font-minecraft transition-colors outline-none w-full ${
                      selectedIndex === idx
                        ? 'bg-ore-accent/20 border-ore-accent/50 text-white'
                        : focused 
                          ? 'bg-[#252528] border-gray-400 text-gray-200' 
                          : 'bg-[#18181A] border-[#2A2A2C] text-gray-400 hover:bg-[#202022]'
                    }`}
                  >
                    <span>{info.name}</span>
                    {selectedIndex === idx && <span className="text-ore-accent text-sm">已选择</span>}
                  </button>
                )}
              </FocusItem>
            ))}
          </div>
        ) : (
          <div className="bg-[#18181A] border border-[#2A2A2C] rounded-md px-4 py-3 w-4/5 flex items-center justify-between">
            <span className="text-gray-400 font-minecraft">目标文件</span>
            <span className="text-gray-200 font-minecraft truncate max-w-[200px]" title={currentMod.fileName}>{currentMod.fileName}</span>
          </div>
        )}
      </div>
    </OreModal>
  );
};
