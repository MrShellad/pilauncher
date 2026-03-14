import React, { useState, useEffect } from 'react';
import { Gamepad2, Download, RefreshCw } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useGamepadModStore } from '../../../store/useGamepadModStore';
import { FocusItem } from '../../../ui/focus/FocusItem';

export const GamepadModPrompt: React.FC = () => {
  const { isOpen, modInfos, promptMode, localFileName, remoteFileName, resolvePrompt } = useGamepadModStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen || !modInfos || modInfos.length === 0) return null;

  const currentMod = modInfos[selectedIndex];
  const hasMultiple = modInfos.length > 1;
  const isUpdate = promptMode === 'update';

  // 从文件名提取版本号用于显示（简单正则匹配）
  const extractVersion = (fileName: string | null | undefined): string => {
    if (!fileName) return '未知';
    // 匹配常见版本号格式如 1.8.18+1.20.1 或 0.20.3 等
    const match = fileName.match(/[-_](\d+\.\d+[\.\d+]*(?:\+[\w.]+)?)/);
    return match ? `v${match[1]}` : fileName;
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={() => resolvePrompt(null)}
      title={isUpdate ? '手柄模块有可用更新' : '检测到缺少手柄支持'}
      className="w-[500px] !z-[100000]"
      actions={
        <>
          <OreButton
            focusKey="gamepad-prompt-btn-cancel"
            variant="secondary"
            onClick={() => resolvePrompt(null)}
            className="flex-1"
          >
            {isUpdate ? '跳过更新并启动' : '取消启动'}
          </OreButton>
          <OreButton
            focusKey="gamepad-prompt-btn-download"
            variant="primary"
            onClick={() => resolvePrompt(currentMod)}
            className="flex-1"
          >
            {isUpdate ? (
              <><RefreshCw size={16} className="mr-2" />更新并启动</>
            ) : (
              <><Download size={16} className="mr-2" />安装并启动</>
            )}
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
          isUpdate ? 'bg-yellow-500/10' : 'bg-ore-accent/10'
        }`}>
          {isUpdate 
            ? <RefreshCw size={40} className="text-yellow-400" />
            : <Gamepad2 size={40} className="text-ore-accent" />
          }
        </div>
        <h3 className="text-white text-xl font-bold mb-3 font-minecraft tracking-wide">
          {isUpdate ? '手柄支持模块可升级' : '推荐安装手柄支持模块'}
        </h3>
        
        {isUpdate ? (
          <>
            <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
              PiLauncher 检测到您的手柄模块有新版本可用，建议更新以获得最佳体验。
            </p>
            {/* 版本号对比 */}
            <div className="bg-[#18181A] border border-[#2A2A2C] rounded-md px-5 py-3 w-4/5 flex items-center justify-between mb-2">
              <div className="flex flex-col items-start">
                <span className="text-gray-500 font-minecraft text-xs mb-1">当前版本</span>
                <span className="text-gray-300 font-minecraft text-sm">{extractVersion(localFileName)}</span>
              </div>
              <span className="text-gray-500 mx-3 text-lg">→</span>
              <div className="flex flex-col items-end">
                <span className="text-yellow-500/70 font-minecraft text-xs mb-1">最新版本</span>
                <span className="text-yellow-400 font-minecraft text-sm font-bold">{extractVersion(remoteFileName)}</span>
              </div>
            </div>
          </>
        ) : hasMultiple ? (
          <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
            PiLauncher 检测到当前实例尚未安装手柄支持功能！我们为您找到了多个适用的选择，请选择：
          </p>
        ) : (
          <p className="text-ore-text-muted text-base px-6 mb-4 leading-relaxed font-minecraft">
            PiLauncher 检测到当前实例尚未安装手柄支持功能！为了获得最佳的游玩体验，我们强烈建议您安装适用于当前版本的 <span className="text-ore-accent">"{currentMod.name}"</span>。
          </p>
        )}

        {!isUpdate && hasMultiple ? (
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
        ) : !isUpdate && (
          <div className="bg-[#18181A] border border-[#2A2A2C] rounded-md px-4 py-3 w-4/5 flex items-start justify-between">
            <span className="text-gray-400 font-minecraft whitespace-nowrap mr-4 shrink-0 mt-0.5">目标文件</span>
            <span className="text-gray-200 font-minecraft break-all text-right leading-relaxed text-sm" title={currentMod.fileName}>{currentMod.fileName}</span>
          </div>
        )}
      </div>
    </OreModal>
  );
};
