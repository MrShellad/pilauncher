// src/features/Instances/components/steps/VersionSelectStep.tsx
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { 
  ArrowRight, Box, Check, Sparkles, TestTubeDiagonal, 
  PartyPopper, RotateCw, ExternalLink, Timer 
} from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { VERSION_TYPES as SHARED_VERSION_TYPES } from '../../logic/environmentSelection';

// ✅ 引入焦点与输入引擎
// ✅ 引入焦点与输入引擎
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { GamepadButtonIcon } from '../../../../ui/components/GamepadButtonIcon';
import {
  STEP_CARD_BASE_CLASS,
  STEP_CONTROL_GROUP_CLASS,
  STEP_FOCUS_RING_CLASS,
  STEP_HEADER_CLASS,
  STEP_HINT_CLASS,
  STEP_IDLE_CARD_CLASS,
  STEP_META_TEXT_CLASS,
  STEP_PAGE_CLASS,
  STEP_SELECTED_CARD_CLASS,
  STEP_SUBTITLE_CLASS,
  STEP_TITLE_CLASS,
  STEP_TOGGLE_CLASS,
  STEP_TOOLBAR_CLASS
} from './stepUi';

export type StepProps = ReturnType<typeof useCustomInstance>;

// 统一提取版本类型，方便循环切换
const VERSION_TYPES = SHARED_VERSION_TYPES;
const versionTypeOptions = VERSION_TYPES.map((type) => ({
  value: type,
  label: (
    <span className="flex items-center gap-[0.375rem]">
      {type === 'release' && <Sparkles size="0.75rem" />}
      {type === 'snapshot' && <TestTubeDiagonal size="0.75rem" />}
      {type === 'rc' && <Timer size="0.75rem" />}
      {type === 'pre' && <PartyPopper size="0.75rem" />}
      {type === 'special' && <Box size="0.75rem" />}
      {type === 'release' ? '正式版' : type === 'snapshot' ? '快照' : type === 'rc' ? '候选' : type === 'pre' ? '预览' : '特殊'}
    </span>
  )
}));

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
    <div className={STEP_PAGE_CLASS}>
      <div className={STEP_HEADER_CLASS}>
        <div>
          <h2 className={STEP_TITLE_CLASS}>选择游戏版本</h2>
          <p className={STEP_SUBTITLE_CLASS}>Step 1: 确定核心游戏版本</p>
        </div>
        <OreButton variant="primary" size="auto" onClick={handleNextStep} disabled={!gameVersion}>
          <span className="flex items-center">
            <GamepadButtonIcon button="Y" size="md" />
            <span className="ml-[0.375rem] flex items-center">下一步 <ArrowRight size="1.125rem" className="ml-[0.25rem]" /></span>
          </span>
        </OreButton>
      </div>

      <div className={STEP_TOOLBAR_CLASS}>
        {/* ======================= 1. 版本类型分段器 (纯视觉，移除焦点) ======================= */}
        <div className={STEP_CONTROL_GROUP_CLASS}>
          <OreToggleButton
            options={versionTypeOptions}
            value={versionType}
            onChange={(value) => setVersionType(value as (typeof VERSION_TYPES)[number])}
            size="sm"
            uiScale="adaptive"
            focusable={false}
            className={STEP_TOGGLE_CLASS}
          />
          {/* ✅ LT / RT 键 UI 提示 */}
          <div className={STEP_HINT_CLASS}>
            <GamepadButtonIcon button="LT" size="lg" />
            <GamepadButtonIcon button="RT" size="lg" />
            <span className="ml-[0.375rem] mt-[0.125rem] tracking-wider">切换分类</span>
          </div>
        </div>

        {/* ======================= 2. 刷新与 Wiki (纯视觉，移除焦点) ======================= */}
        <div className={`${STEP_CONTROL_GROUP_CLASS} justify-end`}>
          {/* ✅ Start 键 UI 提示 */}
          <div className={STEP_HINT_CLASS}>
            <GamepadButtonIcon button="MENU" size="sm" />
            <span className="ml-[0.375rem] mt-[0.125rem] tracking-wider">查看 Wiki</span>
          </div>

          {/* ✅ X 键 UI 提示 */}
          <div className={STEP_HINT_CLASS}>
            <GamepadButtonIcon button="X" size="sm" />
            <span className="ml-[0.375rem] mt-[0.125rem] tracking-wider">刷新列表</span>
          </div>
          <button 
            onClick={handleRefreshVersions} 
            disabled={isLoadingVersions}
            tabIndex={-1}
            className={`
              flex-shrink-0 rounded-[0.125rem] border-[0.125rem] bg-[#1E1E1F] p-[0.5rem] transition-all outline-none
              ${isLoadingVersions ? 'opacity-60 border-ore-gray-border text-ore-text-muted' : 'border-ore-gray-border text-ore-text-muted hover:text-white hover:border-white'}
            `}
            title="刷新列表"
          >
            <RotateCw size="1.125rem" className={isLoadingVersions ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ======================= 3. 版本列表区域 (核心操作区) ======================= */}
      <OreOverlayScrollArea
        className="min-h-0 flex-1"
        contentClassName="space-y-[1rem] pb-[3rem] px-[0.25rem] pt-[0.25rem]"
        safeInsetTop={4}
        safeInsetBottom={8}
      >
        {isLoadingVersions ? (
          <div className="flex h-[8rem] w-full flex-col items-center justify-center font-minecraft text-ore-text-muted animate-pulse">
            <span className="text-[1.125rem] leading-[1.75rem]">正在更新版本清单...</span>
          </div>
        ) : filteredVersionGroups.map((g, i) => (
          <OreAccordion key={g.group_name} title={g.group_name} defaultExpanded={i === 0}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] gap-[0.75rem] p-[0.75rem]">
              {g.versions.map(v => (
                <FocusItem key={v.id} focusKey={`version-card-${v.id}`} onEnter={() => setGameVersion(v.id)}>
                  {({ ref, focused }) => (
                    <motion.div 
                      ref={ref as any}
                      whileHover={OreMotionTokens.buttonHover} 
                      whileTap={OreMotionTokens.buttonTap} 
                      onClick={() => setGameVersion(v.id)} 
                      className={`
                        ${STEP_CARD_BASE_CLASS} group relative flex min-h-[5.5rem] flex-col justify-between
                        ${gameVersion === v.id ? STEP_SELECTED_CARD_CLASS : STEP_IDLE_CARD_CLASS}
                        ${focused ? STEP_FOCUS_RING_CLASS : ''}
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
                          absolute bottom-[0.5rem] right-[0.5rem] z-30 rounded-[0.125rem] p-[0.25rem] transition-all outline-none
                          opacity-0 group-hover:opacity-100 text-ore-text-muted hover:text-white hover:bg-white/10
                        `}
                        title="查看 Wiki (手柄按 Start 键)"
                      >
                        <ExternalLink size="0.875rem" />
                      </button>

                      {gameVersion === v.id && <Check size="1rem" className="absolute right-[0.5rem] top-[0.5rem] text-ore-green" />}
                      
                      <span className="break-words pr-[1.5rem] font-minecraft text-[1rem] font-bold leading-[1.25rem] text-white">
                        {v.id}
                      </span>
                      
                      <span className={`${STEP_META_TEXT_CLASS} mt-[0.5rem]`}>
                        {v.release_time}
                      </span>
                    </motion.div>
                  )}
                </FocusItem>
              ))}
            </div>
          </OreAccordion>
        ))}
      </OreOverlayScrollArea>
    </div>
  );
};
