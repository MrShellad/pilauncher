import React, { useEffect, useState } from 'react';
import { Download, Gamepad2, RefreshCw } from 'lucide-react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useGamepadModStore } from '../../../store/useGamepadModStore';
import { FocusItem } from '../../../ui/focus/FocusItem';

export const GamepadModPrompt: React.FC = () => {
  const {
    isOpen,
    modInfos,
    promptMode,
    localFileName,
    remoteFileName,
    resolvePrompt,
  } = useGamepadModStore();
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

  const extractVersion = (fileName: string | null | undefined): string => {
    if (!fileName) return '未知';
    const match = fileName.match(/[-_](\d+\.\d+[\.\d+]*(?:\+[\w.]+)?)/);
    return match ? `v${match[1]}` : fileName;
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={() => resolvePrompt(null)}
      title={isUpdate ? '手柄模块有可用更新' : '检测到缺少手柄支持'}
      className="w-[500px]"
      wrapperClassName="!z-[100000]"
      defaultFocusKey="gamepad-prompt-btn-download"
      actions={
        <>
          <OreButton
            focusKey="gamepad-prompt-btn-cancel"
            variant="secondary"
            onClick={() => resolvePrompt(null)}
            className="flex-1"
          >
            {isUpdate ? '跳过更新并启动' : '跳过安装并启动'}
          </OreButton>
          <OreButton
            focusKey="gamepad-prompt-btn-download"
            variant="primary"
            onClick={() => resolvePrompt(currentMod)}
            className="flex-1"
          >
            {isUpdate ? (
              <>
                <RefreshCw size={16} className="mr-2" />
                更新并启动
              </>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                安装并启动
              </>
            )}
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div
          className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
            isUpdate ? 'bg-yellow-500/10' : 'bg-ore-accent/10'
          }`}
        >
          {isUpdate ? (
            <RefreshCw size={40} className="text-yellow-400" />
          ) : (
            <Gamepad2 size={40} className="text-ore-accent" />
          )}
        </div>

        <h3 className="mb-3 font-minecraft text-xl font-bold tracking-wide text-white">
          {isUpdate ? '手柄支持模块可升级' : '推荐安装手柄支持模块'}
        </h3>

        {isUpdate ? (
          <>
            <p className="mb-4 px-6 font-minecraft text-base leading-relaxed text-ore-text-muted">
              PiLauncher 检测到您的手柄模块有新版本可用，建议更新以获得更好的体验。
              如果您现在不想更新，也可以直接继续启动游戏。
            </p>
            <div className="mb-2 flex w-4/5 items-center justify-between rounded-md border border-[#2A2A2C] bg-[#18181A] px-5 py-3">
              <div className="flex flex-col items-start">
                <span className="mb-1 font-minecraft text-xs text-gray-500">当前版本</span>
                <span className="font-minecraft text-sm text-gray-300">
                  {extractVersion(localFileName)}
                </span>
              </div>
              <span className="mx-3 text-lg text-gray-500">→</span>
              <div className="flex flex-col items-end">
                <span className="mb-1 font-minecraft text-xs text-yellow-500/70">最新版本</span>
                <span className="font-minecraft text-sm font-bold text-yellow-400">
                  {extractVersion(remoteFileName)}
                </span>
              </div>
            </div>
          </>
        ) : hasMultiple ? (
          <p className="mb-4 px-6 font-minecraft text-base leading-relaxed text-ore-text-muted">
            PiLauncher 检测到当前实例尚未安装手柄支持功能。我们找到了多个适用选项，
            您可以选择一个安装，也可以直接跳过并启动游戏。
          </p>
        ) : (
          <p className="mb-4 px-6 font-minecraft text-base leading-relaxed text-ore-text-muted">
            PiLauncher 检测到当前实例尚未安装手柄支持功能。为了获得更好的游玩体验，
            推荐安装适用于当前版本的
            <span className="text-ore-accent"> “{currentMod.name}” </span>
            ，但是否安装由您决定。
          </p>
        )}

        {!isUpdate && hasMultiple ? (
          <div className="flex w-4/5 flex-col gap-2">
            {modInfos.map((info, idx) => (
              <FocusItem
                key={info.id}
                focusKey={`gamepad-mod-${info.id}`}
                onEnter={() => setSelectedIndex(idx)}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref}
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full rounded-md border px-4 py-3 text-left font-minecraft outline-none transition-colors ${
                      selectedIndex === idx
                        ? 'border-ore-accent/50 bg-ore-accent/20 text-white'
                        : focused
                          ? 'border-gray-400 bg-[#252528] text-gray-200'
                          : 'border-[#2A2A2C] bg-[#18181A] text-gray-400 hover:bg-[#202022]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{info.name}</span>
                      {selectedIndex === idx && (
                        <span className="text-sm text-ore-accent">已选择</span>
                      )}
                    </div>
                  </button>
                )}
              </FocusItem>
            ))}
          </div>
        ) : !isUpdate ? (
          <div className="flex w-4/5 items-start justify-between rounded-md border border-[#2A2A2C] bg-[#18181A] px-4 py-3">
            <span className="mr-4 mt-0.5 shrink-0 whitespace-nowrap font-minecraft text-gray-400">
              目标文件
            </span>
            <span
              className="break-all text-right font-minecraft text-sm leading-relaxed text-gray-200"
              title={currentMod.fileName}
            >
              {currentMod.fileName}
            </span>
          </div>
        ) : null}
      </div>
    </OreModal>
  );
};
