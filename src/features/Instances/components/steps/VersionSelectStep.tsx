// src/features/Instances/components/steps/VersionSelectStep.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { 
  ArrowRight, Check, Sparkles, TestTubeDiagonal, 
  PartyPopper, RotateCw, ExternalLink, Timer 
} from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';

// ✅ 引入空间导航组件
import { FocusItem } from '../../../../ui/focus/FocusItem';

export type StepProps = ReturnType<typeof useCustomInstance>;

export const VersionSelectStep: React.FC<StepProps> = ({
  gameVersion, setGameVersion, versionType, setVersionType, 
  filteredVersionGroups, isLoadingVersions, handleNextStep, 
  handleRefreshVersions, handleOpenWiki
}) => {
  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pt-4 min-h-0">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-minecraft text-white ore-text-shadow">选择游戏版本</h2>
          <p className="text-ore-text-muted font-minecraft text-sm mt-1 tracking-widest">Step 1: 确定核心游戏版本</p>
        </div>
        <OreButton variant="primary" size="auto" onClick={handleNextStep} disabled={!gameVersion}>
          <span className="flex items-center">下一步 <ArrowRight size={18} className="ml-2" /></span>
        </OreButton>
      </div>

      <div className="flex w-full mb-6 items-center justify-between gap-4">
        {/* ======================= 1. 版本类型分段器 ======================= */}
        {/* ✅ 去除原有的 overflow-hidden，防止高光焦点环被截断 */}
        <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 relative">
          {(['release', 'snapshot', 'rc', 'pre', 'special'] as const).map(t => (
            <FocusItem key={t} focusKey={`version-type-${t}`} onEnter={() => setVersionType(t)}>
              {({ ref, focused }) => (
                <button 
                  ref={ref as any}
                  onClick={() => setVersionType(t)} 
                  tabIndex={-1}
                  className={`
                    relative px-3 py-2 font-minecraft text-xs z-10 transition-colors whitespace-nowrap outline-none rounded-sm
                    ${versionType === t ? 'text-white' : 'text-ore-text-muted hover:text-white'}
                    ${focused ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-[var(--ore-focus-ring)] outline-offset-1 bg-white/10 z-20' : ''}
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
              )}
            </FocusItem>
          ))}
        </div>

        {/* ======================= 2. 刷新按钮 ======================= */}
        <FocusItem focusKey="refresh-versions-btn" onEnter={handleRefreshVersions} disabled={isLoadingVersions}>
          {({ ref, focused }) => (
            <button 
              ref={ref as any}
              onClick={handleRefreshVersions} 
              disabled={isLoadingVersions}
              tabIndex={-1}
              className={`
                p-2 border-2 bg-[#1E1E1F] transition-all flex-shrink-0 outline-none rounded-sm
                ${isLoadingVersions ? 'opacity-50 border-ore-gray-border text-ore-text-muted' : 'border-ore-gray-border text-ore-text-muted hover:text-white hover:border-white'}
                ${focused ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-[var(--ore-focus-ring)] outline-offset-2 z-20 drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110 border-transparent text-white' : ''}
              `}
              title="刷新列表"
            >
              <RotateCw size={18} className={isLoadingVersions ? 'animate-spin' : ''} />
            </button>
          )}
        </FocusItem>
      </div>

      {/* ======================= 3. 版本列表区域 ======================= */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-12 px-1 custom-scrollbar min-h-0">
        {isLoadingVersions ? (
          <div className="w-full h-32 flex flex-col items-center justify-center text-ore-text-muted font-minecraft animate-pulse">
            <span className="text-lg">正在更新版本清单...</span>
          </div>
        ) : filteredVersionGroups.map((g, i) => (
          <OreAccordion key={g.group_name} title={g.group_name} defaultExpanded={i === 0}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-2">
              {g.versions.map(v => (
                // ✅ 为每一张版本卡片挂载 FocusItem
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
                        ${focused ? 'outline outline-[3px] outline-[var(--ore-focus-ringFallback)] outline-[var(--ore-focus-ring)] outline-offset-[2px] z-20 drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110' : ''}
                      `}
                    >
                      
                      {/* ======================= 4. 内部 Wiki 跳转按钮 ======================= */}
                      <FocusItem focusKey={`wiki-btn-${v.id}`} onEnter={() => handleOpenWiki(v.wiki_url)}>
                        {({ ref: wikiRef, focused: wikiFocused }) => (
                          <button
                            ref={wikiRef as any}
                            onClick={(e) => {
                              e.stopPropagation(); // 鼠标点击时阻止冒泡，防止触发卡片的 onClick
                              handleOpenWiki(v.wiki_url);
                            }}
                            tabIndex={-1}
                            className={`
                              absolute bottom-2 right-2 p-1 transition-all z-30 outline-none rounded-sm
                              ${wikiFocused ? 'opacity-100 outline outline-[2px] outline-[var(--ore-focus-ring)] outline-offset-1 bg-white/20 text-white' : 'opacity-0 group-hover:opacity-100 text-ore-text-muted hover:text-white'}
                            `}
                            title="查看 Wiki"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </FocusItem>

                      {/* 选中状态打勾 */}
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