import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { OreToggleButton } from '../../../../ui/primitives/OreToggleButton';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { LOADER_TYPES as SHARED_LOADER_TYPES } from '../../logic/environmentSelection';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { GamepadButtonIcon } from '../../../../ui/components/GamepadButtonIcon';
import {
  STEP_ACTIONS_CLASS,
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

import vanillaIcon from '../../../../assets/icons/tags/loaders/vanilla.svg';
import fabricIcon from '../../../../assets/icons/tags/loaders/fabric.svg';
import quiltIcon from '../../../../assets/icons/tags/loaders/quilt.svg';
import forgeIcon from '../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../assets/icons/tags/loaders/neoforge.svg';

export type StepProps = ReturnType<typeof useCustomInstance>;

const LOADER_TYPES = SHARED_LOADER_TYPES;
const loaderIconClassName = (isActive: boolean) =>
  `size-[var(--ore-toggle-icon-size)] object-contain drop-shadow-md brightness-0${isActive ? ' invert' : ''}`;

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

  const loaderTypeOptions = LOADER_TYPES.map((type) => ({
    value: type,
    label: (
      <span className="flex items-center gap-[0.375rem]">
        {type === 'Vanilla' && <img src={vanillaIcon} className={loaderIconClassName(type === loaderType)} alt="Vanilla" />}
        {type === 'Fabric' && <img src={fabricIcon} className={loaderIconClassName(type === loaderType)} alt="Fabric" />}
        {type === 'Quilt' && <img src={quiltIcon} className={loaderIconClassName(type === loaderType)} alt="Quilt" />}
        {type === 'Forge' && <img src={forgeIcon} className={loaderIconClassName(type === loaderType)} alt="Forge" />}
        {type === 'NeoForge' && <img src={neoforgeIcon} className={loaderIconClassName(type === loaderType)} alt="NeoForge" />}
        {type}
      </span>
    )
  }));

  return (
    <div className={STEP_PAGE_CLASS}>
      <div className={STEP_HEADER_CLASS}>
        <div>
          <h2 className={STEP_TITLE_CLASS}>选择引导器</h2>
          <p className={STEP_SUBTITLE_CLASS}>Step 2: 赋予游戏 Mod 运行能力</p>
        </div>
        <div className={STEP_ACTIONS_CLASS}>
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            <ChevronLeft size="1.125rem" className="mr-[0.25rem]" />上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={handleNextStep}>
            <span className="flex items-center">
              <GamepadButtonIcon button="Y" size="md" />
              <span className="ml-[0.375rem] flex items-center">下一步 <ArrowRight size="1.125rem" className="ml-[0.25rem]" /></span>
            </span>
          </OreButton>
        </div>
      </div>

      {/* 引导器类型切换 */}
      <div className={STEP_TOOLBAR_CLASS}>
        <div className={STEP_CONTROL_GROUP_CLASS}>
          <OreToggleButton
            options={loaderTypeOptions}
            value={loaderType}
            onChange={(value) => setLoaderType(value as (typeof LOADER_TYPES)[number])}
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
      </div>

      {/* 引导器版本列表，带平滑加载动画 */}
      <OreOverlayScrollArea
        className="min-h-0 flex-1"
        contentClassName="min-h-full"
        safeInsetTop={4}
        safeInsetBottom={8}
      >
        <AnimatePresence mode="wait">
          {isLoadingLoaders ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: '0.625rem' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '-0.625rem' }}
              transition={{ duration: 0.2 }}
              className="flex h-[8rem] w-full items-center justify-center font-minecraft text-ore-text-muted"
            >
              <span className="animate-pulse">正在查找兼容版本...</span>
            </motion.div>
          ) : loaderType === 'Vanilla' ? (
            <motion.div
              key="vanilla"
              initial={{ opacity: 0, y: '0.625rem' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '-0.625rem' }}
              transition={{ duration: 0.2 }}
              className="flex h-[12rem] w-full flex-col items-center justify-center border-[0.125rem] border-dashed border-ore-gray-border"
            >
              <img src={vanillaIcon} className="mb-[0.75rem] h-[3rem] w-[3rem] object-contain opacity-70 invert-[.45]" alt="Vanilla" />
              <span className="font-minecraft text-[1.25rem] leading-[1.75rem] tracking-widest text-white">纯净原版已就绪</span>
            </motion.div>
          ) : (
            <motion.div
              key={`loader-list-${loaderType}`}
              initial={{ opacity: 0, y: '0.625rem' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '-0.625rem' }}
              transition={{ duration: 0.2 }}
              className="pb-[3rem]"
            >
              <OreAccordion title={`${loaderType} 可用版本`} defaultExpanded>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-[0.75rem] p-[0.5rem]">
                  {loaderVersions.map(v => (
                    <FocusItem key={v} focusKey={`loader-card-${v}`} onEnter={() => setLoaderVersion(v)}>
                      {({ ref, focused }) => (
                        <motion.div
                          ref={ref as any}
                          whileHover={OreMotionTokens.buttonHover}
                          whileTap={OreMotionTokens.buttonTap}
                          onClick={() => setLoaderVersion(v)}
                          className={`
                            ${STEP_CARD_BASE_CLASS} flex min-h-[4.75rem] flex-col justify-center
                            ${loaderVersion === v ? STEP_SELECTED_CARD_CLASS : STEP_IDLE_CARD_CLASS}
                            ${focused ? STEP_FOCUS_RING_CLASS : ''}
                          `}
                        >
                          <span className="font-minecraft font-bold leading-[1.25rem] text-white">{v}</span>
                          <p className={`${STEP_META_TEXT_CLASS} mt-[0.25rem]`}>适用: {gameVersion}</p>
                        </motion.div>
                      )}
                    </FocusItem>
                  ))}
                </div>
              </OreAccordion>
            </motion.div>
          )}
        </AnimatePresence>
      </OreOverlayScrollArea>
    </div>
  );
};
