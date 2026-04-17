import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../ui/focus/InputDriver';

import vanillaIcon from '../../../../assets/icons/tags/loaders/vanilla.svg';
import fabricIcon from '../../../../assets/icons/tags/loaders/fabric.svg';
import quiltIcon from '../../../../assets/icons/tags/loaders/quilt.svg';
import forgeIcon from '../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../assets/icons/tags/loaders/neoforge.svg';

export type StepProps = ReturnType<typeof useCustomInstance>;

const LOADER_TYPES = ['Vanilla', 'NeoForge', 'Forge', 'Fabric', 'Quilt'] as const;

// 🎮 手柄按键 SVG 图标组件
const GamepadBtn = ({ text, color, shadow, fontSize = "13" }: { text: string, color: string, shadow: string, fontSize?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block flex-shrink-0">
    <circle cx="12" cy="12" r="10" fill={color} className={shadow} />
    <text x="12" y="16.5" fontSize={fontSize} fontWeight="900" fontFamily="system-ui, sans-serif" fill="#1E1E1F" textAnchor="middle">
      {text}
    </text>
  </svg>
);

export const LoaderSelectStep: React.FC<StepProps> = ({
  gameVersion, loaderType, setLoaderType, loaderVersion, setLoaderVersion,
  loaderVersions, isLoadingLoaders, handleNextStep, handlePrevStep
}) => {

  // ======================= 🎮 快捷键挂载 =======================

  // 监听 LT / RT 键：循环切换引导器分类
  const cycleLoaderType = useCallback((direction: 1 | -1) => {
    const currentIndex = LOADER_TYPES.indexOf(loaderType as any);
    const nextIndex = (currentIndex + direction + LOADER_TYPES.length) % LOADER_TYPES.length;
    setLoaderType(LOADER_TYPES[nextIndex]);
  }, [loaderType, setLoaderType]);

  useInputAction('PAGE_LEFT', () => cycleLoaderType(-1)); // LT
  useInputAction('PAGE_RIGHT', () => cycleLoaderType(1)); // RT

  // 监听 Y 键：进入下一步
  useInputAction('ACTION_Y', () => {
    if (!isLoadingLoaders) handleNextStep();
  });
  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pt-4 min-h-0">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-minecraft text-white ore-text-shadow">选择引导器</h2>
          <p className="text-ore-text-muted font-minecraft text-sm mt-1 tracking-widest">Step 2: 赋予游戏 Mod 运行能力</p>
        </div>
        <div className="flex space-x-4">
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            <ChevronLeft size={18} className="mr-1" />上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={handleNextStep}>
            <span className="flex items-center">
              {/* ✅ Y 键 UI 提示 */}
              <GamepadBtn text="Y" color="#FACC15" shadow="drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" />
              <span className="ml-1.5 flex items-center">下一步 <ArrowRight size={18} className="ml-1" /></span>
            </span>
          </OreButton>
        </div>
      </div>

      {/* 引导器类型切换 */}
      <div className="flex w-full mb-6 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 relative overflow-hidden">
            {LOADER_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setLoaderType(t)}
                tabIndex={-1}
                className={`relative px-4 py-2 font-minecraft text-sm z-10 transition-colors whitespace-nowrap outline-none ${loaderType === t ? 'text-white' : 'text-ore-text-muted hover:text-white'}`}
              >
                {loaderType === t && (
                  <motion.div
                    layoutId="lTab"
                    className="absolute inset-0 bg-white/20 shadow-inner"
                    transition={OreMotionTokens.segmentActiveLayout as any}
                  />
                )}
                {/* ✅ 在这里加入对应的图标映射 */}
                <span className="relative flex items-center gap-1.5">
                  {t === 'Vanilla' && <img src={vanillaIcon} className="w-[14px] h-[14px] object-contain drop-shadow-md brightness-0 invert" alt="Vanilla" />}
                  {t === 'Fabric' && <img src={fabricIcon} className="w-[14px] h-[14px] object-contain drop-shadow-md brightness-0 invert" alt="Fabric" />}
                  {t === 'Quilt' && <img src={quiltIcon} className="w-[14px] h-[14px] object-contain drop-shadow-md brightness-0 invert" alt="Quilt" />}
                  {t === 'Forge' && <img src={forgeIcon} className="w-[14px] h-[14px] object-contain drop-shadow-md brightness-0 invert" alt="Forge" />}
                  {t === 'NeoForge' && <img src={neoforgeIcon} className="w-[14px] h-[14px] object-contain drop-shadow-md brightness-0 invert" alt="NeoForge" />}
                  {t}
                </span>
              </button>
            ))}
          </div>
          {/* ✅ LT / RT 键 UI 提示 */}
          <div className="flex items-center text-ore-text-muted font-minecraft text-xs select-none gap-0.5">
            <GamepadBtn text="LT" color="#48494A" shadow="drop-shadow-[0_0_2px_rgba(255,255,255,0.2)]" fontSize="10" />
            <GamepadBtn text="RT" color="#48494A" shadow="drop-shadow-[0_0_2px_rgba(255,255,255,0.2)]" fontSize="10" />
            <span className="ml-1.5 mt-0.5 tracking-wider">切换分类</span>
          </div>
        </div>
      </div>

      {/* 引导器版本列表，带平滑加载动画 */}
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
        <AnimatePresence mode="wait">
          {isLoadingLoaders ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-32 flex items-center justify-center text-ore-text-muted font-minecraft"
            >
              <span className="animate-pulse">正在查找兼容版本...</span>
            </motion.div>
          ) : loaderType === 'Vanilla' ? (
            <motion.div
              key="vanilla"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-ore-gray-border"
            >
              <img src={vanillaIcon} className="w-12 h-12 opacity-50 mb-3 object-contain invert-[.3]" alt="Vanilla" />
              <span className="font-minecraft text-white text-xl tracking-widest">纯净原版已就绪</span>
            </motion.div>
          ) : (
            <motion.div
              key={`loader-list-${loaderType}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="pb-12"
            >
              <OreAccordion title={`${loaderType} 可用版本`} defaultExpanded>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-2">
                  {loaderVersions.map(v => (
                    <FocusItem key={v} focusKey={`loader-card-${v}`} onEnter={() => setLoaderVersion(v)}>
                      {({ ref, focused }) => (
                        <motion.div
                          ref={ref as any}
                          whileHover={OreMotionTokens.buttonHover}
                          whileTap={OreMotionTokens.buttonTap}
                          onClick={() => setLoaderVersion(v)}
                          className={`
                            p-3 border-2 cursor-pointer transition-all flex flex-col justify-center rounded-sm outline-none
                            ${loaderVersion === v ? 'bg-ore-green/20 border-ore-green' : 'bg-[#1E1E1F] border-ore-gray-border hover:border-white/50'}
                            ${focused ? 'outline outline-[3px] outline-ore-focus outline-offset-[2px] z-20 drop-shadow-ore-glow brightness-110' : ''}
                          `}
                        >
                          <span className="font-minecraft text-white font-bold">{v}</span>
                          <p className="text-[10px] text-ore-text-muted mt-1">适用: {gameVersion}</p>
                        </motion.div>
                      )}
                    </FocusItem>
                  ))}
                </div>
              </OreAccordion>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};