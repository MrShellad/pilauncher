// src/features/Instances/components/steps/VersionSelectStep.tsx
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { 
  ArrowRight, Check, Sparkles, TestTubeDiagonal, 
  PartyPopper, RotateCw, ExternalLink, Timer 
} from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';

// ✅ 引入焦点与输入引擎
// ✅ 引入焦点与输入引擎
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

export type StepProps = ReturnType<typeof useCustomInstance>;

// 统一提取版本类型，方便循环切换
const VERSION_TYPES = ['release', 'snapshot', 'rc', 'pre', 'special'] as const;

// 🎮 手柄按键 SVG 图标组件
const GamepadBtn = ({ text, color, shadow, fontSize = "13" }: { text: string, color: string, shadow: string, fontSize?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block flex-shrink-0">
    <circle cx="12" cy="12" r="10" fill={color} className={shadow} />
    <text x="12" y="16.5" fontSize={fontSize} fontWeight="900" fontFamily="system-ui, sans-serif" fill="#1E1E1F" textAnchor="middle">
      {text}
    </text>
  </svg>
);

export const VersionSelectStep: React.FC<StepProps> = ({
  gameVersion, setGameVersion, versionType, setVersionType, 
  filteredVersionGroups, isLoadingVersions, handleNextStep, 
  handleRefreshVersions, handleOpenWiki
}) => {

  // ======================= 🎮 快捷键挂载 =======================
  
  // 监听 LT / RT 键：循环切换版本分类
  const cycleVersionType = useCallback((direction: 1 | -1) => {
    const currentIndex = VERSION_TYPES.indexOf(versionType as any);
    const nextIndex = (currentIndex + direction + VERSION_TYPES.length) % VERSION_TYPES.length;
    setVersionType(VERSION_TYPES[nextIndex]);
  }, [versionType, setVersionType]);

  useInputAction('PAGE_LEFT', () => cycleVersionType(-1)); // LT
  useInputAction('PAGE_RIGHT', () => cycleVersionType(1)); // RT
  
  // 监听 Y 键：进入下一步
  useInputAction('ACTION_Y', () => {
    if (gameVersion) handleNextStep();
  });

  // 监听 X 键：刷新列表
  useInputAction('ACTION_X', () => {
    if (!isLoadingVersions) handleRefreshVersions();
  });

  // 监听 Start/MENU 键：查询当前聚焦的元素并打开 Wiki
  useInputAction('MENU', () => {
    const currentKey = getCurrentFocusKey();
    if (currentKey && currentKey.startsWith('version-card-')) {
      const versionId = currentKey.replace('version-card-', '');
      handleOpenWiki(versionId);
    }
  });

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pt-4 min-h-0">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-minecraft text-white ore-text-shadow">选择游戏版本</h2>
          <p className="text-ore-text-muted font-minecraft text-sm mt-1 tracking-widest">Step 1: 确定核心游戏版本</p>
        </div>
        <OreButton variant="primary" size="auto" onClick={handleNextStep} disabled={!gameVersion}>
          <span className="flex items-center">
            {/* ✅ Y 键 UI 提示 */}
            <GamepadBtn text="Y" color="#FACC15" shadow="drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" />
            <span className="ml-1.5 flex items-center">下一步 <ArrowRight size={18} className="ml-1" /></span>
          </span>
        </OreButton>
      </div>

      <div className="flex w-full mb-6 items-center justify-between gap-4">
        {/* ======================= 1. 版本类型分段器 (纯视觉，移除焦点) ======================= */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 relative">
            {VERSION_TYPES.map(t => (
              <button 
                key={t}
                onClick={() => setVersionType(t)} 
                tabIndex={-1}
                className={`
                  relative px-3 py-2 font-minecraft text-xs z-10 transition-colors whitespace-nowrap outline-none rounded-sm
                  ${versionType === t ? 'text-white' : 'text-ore-text-muted hover:text-white'}
                `}
              >
                {versionType === t && (
                  <motion.div 
                    layoutId="vTab" 
                    className="absolute inset-0 bg-white/20 shadow-inner" 
                    transition={OreMotionTokens.segmentActiveLayout} 
                  />
                )}
                <span className="relative flex items-center">
                  {t === 'release' && <Sparkles size={12} className="mr-1.5" />}
                  {t === 'snapshot' && <TestTubeDiagonal size={12} className="mr-1.5" />}
                  {t === 'rc' && <Timer size={12} className="mr-1.5" />}
                  {t === 'pre' && <PartyPopper size={12} className="mr-1.5" />}
                  {t === 'release' ? '正式版' : t === 'snapshot' ? '快照' : t === 'rc' ? '候选' : t === 'pre' ? '预览' : '特殊'}
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

        {/* ======================= 2. 刷新与 Wiki (纯视觉，移除焦点) ======================= */}
        <div className="flex items-center gap-3">
          {/* ✅ Start 键 UI 提示 */}
          <div className="flex items-center text-ore-text-muted font-minecraft text-xs select-none">
            <GamepadBtn text="≡" color="#48494A" shadow="drop-shadow-[0_0_2px_rgba(255,255,255,0.2)]" />
            <span className="ml-1.5 mt-0.5 tracking-wider">查看 Wiki</span>
          </div>

          {/* ✅ X 键 UI 提示 */}
          <div className="flex items-center text-ore-text-muted font-minecraft text-xs select-none pl-2">
            <GamepadBtn text="X" color="#60A5FA" shadow="drop-shadow-[0_0_4px_rgba(96,165,250,0.5)]" />
            <span className="ml-1.5 mt-0.5 tracking-wider">刷新列表</span>
          </div>
          <button 
            onClick={handleRefreshVersions} 
            disabled={isLoadingVersions}
            tabIndex={-1}
            className={`
              p-2 border-2 bg-[#1E1E1F] transition-all flex-shrink-0 outline-none rounded-sm
              ${isLoadingVersions ? 'opacity-50 border-ore-gray-border text-ore-text-muted' : 'border-ore-gray-border text-ore-text-muted hover:text-white hover:border-white'}
            `}
            title="刷新列表"
          >
            <RotateCw size={18} className={isLoadingVersions ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ======================= 3. 版本列表区域 (核心操作区) ======================= */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-12 px-1 pt-1 custom-scrollbar min-h-0">
        {isLoadingVersions ? (
          <div className="w-full h-32 flex flex-col items-center justify-center text-ore-text-muted font-minecraft animate-pulse">
            <span className="text-lg">正在更新版本清单...</span>
          </div>
        ) : filteredVersionGroups.map((g, i) => (
          <OreAccordion key={g.group_name} title={g.group_name} defaultExpanded={i === 0}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-3">
              {g.versions.map(v => (
                <FocusItem key={v.id} focusKey={`version-card-${v.id}`} onEnter={() => setGameVersion(v.id)}>
                  {({ ref, focused }) => (
                    <motion.div 
                      ref={ref as any}
                      whileHover={OreMotionTokens.buttonHover} 
                      whileTap={OreMotionTokens.buttonTap} 
                      onClick={() => setGameVersion(v.id)} 
                      className={`
                        group relative flex flex-col justify-between p-3 cursor-pointer border-2 transition-all outline-none rounded-sm
                        ${gameVersion === v.id ? 'bg-ore-green/20 border-ore-green' : 'bg-[#1E1E1F] border-ore-gray-border hover:border-white/50'}
                        ${focused ? 'outline outline-[3px] outline-ore-focus outline-offset-[2px] z-20 drop-shadow-ore-glow brightness-110' : ''}
                      `}
                    >
                      {/* ======================= 4. 内部 Wiki 跳转按钮 ======================= */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWiki(v.id);
                        }}
                        tabIndex={-1}
                        className={`
                          absolute bottom-2 right-2 p-1 transition-all z-30 outline-none rounded-sm
                          opacity-0 group-hover:opacity-100 text-ore-text-muted hover:text-white hover:bg-white/10
                        `}
                        title="查看 Wiki (手柄按 Start 键)"
                      >
                        <ExternalLink size={14} />
                      </button>

                      {gameVersion === v.id && <Check size={16} className="absolute top-2 right-2 text-ore-green" />}
                      
                      <span className="font-minecraft text-base text-white font-bold break-words pr-6 leading-tight">
                        {v.id}
                      </span>
                      
                      <span className="text-[10px] text-ore-text-muted mt-2">
                        {v.release_time}
                      </span>
                    </motion.div>
                  )}
                </FocusItem>
              ))}
            </div>
          </OreAccordion>
        ))}
      </div>
    </div>
  );
};