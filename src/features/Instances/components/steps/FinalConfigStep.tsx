import React, { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  Box,
  Camera,
  ChevronLeft,
  Folder,
  FolderOpen,
  HardDrive,
  Info,
  Layers,
  Pickaxe,
  Sparkles
} from 'lucide-react';

import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { focusManager } from '../../../../ui/focus/FocusManager';
import { useInputAction } from '../../../../ui/focus/InputDriver';
import { GamepadButtonIcon } from '../../../../ui/components/GamepadButtonIcon';
import {
  STEP_ACTIONS_CLASS,
  STEP_HEADER_LARGE_CLASS,
  STEP_PAGE_CLASS,
  STEP_SUBTITLE_CLASS,
  STEP_TITLE_CLASS
} from './stepUi';

type StepProps = ReturnType<typeof useCustomInstance>;

export const FinalConfigStep: React.FC<StepProps> = ({
  gameVersion,
  loaderType,
  loaderVersion,
  instanceName,
  setInstanceName,
  folderName,
  save_path,
  setSavePath,
  coverImage,
  setCoverImage,
  handlePrevStep,
  handleCreate
}) => {
  // ======================= 🎮 快捷键挂载 =======================
  // 监听手柄 Y 键：直接触发创建
  useInputAction('ACTION_Y', () => {
    void handleCreate();
  });

  // 监听手柄 B 键 / LT 键：返回上一步
  useInputAction('CANCEL', handlePrevStep);
  useInputAction('PAGE_LEFT', handlePrevStep);

  useEffect(() => {
    const timer = setTimeout(() => {
      focusManager.focus('final-config-name');
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectCover = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        title: '选择自定义封面',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      });

      if (selectedPath && typeof selectedPath === 'string') {
        setCoverImage(selectedPath);
      }
    } catch (error) {
      console.error('图片选择失败:', error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: '选择实例保存路径',
        defaultPath: save_path
      });

      if (selectedDir && typeof selectedDir === 'string') {
        setSavePath(selectedDir);
      }
    } catch (error) {
      console.error('文件夹选择失败:', error);
    }
  };

  return (
    <div className={STEP_PAGE_CLASS}>
      {/* 顶部标题与操作栏 */}
      <div className={`${STEP_HEADER_LARGE_CLASS} w-full max-w-[84rem] mx-auto`}>
        <div>
          <h2 className={STEP_TITLE_CLASS}>完善信息</h2>
          <p className={STEP_SUBTITLE_CLASS}>
            Step 3: 设置实例外观与存放位置
          </p>
        </div>
        <div className={STEP_ACTIONS_CLASS}>
          <FocusItem focusKey="final-config-btn-prev" onEnter={handlePrevStep}>
            {({ ref, focused }) => (
              <div ref={ref as any} className={focused ? 'ring-2 ring-white rounded-sm' : ''}>
                <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
                  <ChevronLeft size="1.125rem" className="mr-[0.25rem]" /> 上一步
                </OreButton>
              </div>
            )}
          </FocusItem>
          <FocusItem focusKey="final-config-btn-create" onEnter={() => { void handleCreate(); }}>
            {({ ref, focused }) => (
              <div ref={ref as any} className={focused ? 'ring-2 ring-white rounded-sm' : ''}>
                <OreButton variant="primary" size="auto" onClick={() => { void handleCreate(); }}>
                  <span className="flex items-center">
                    <GamepadButtonIcon button="Y" size="md" />
                    <span className="ml-[0.375rem] flex items-center">
                      开始创建 <Pickaxe size="1.125rem" className="ml-[0.375rem]" />
                    </span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </div>

      {/* 主体滚动区：自适应双栏网格布局 */}
      <OreOverlayScrollArea
        className="min-h-0 flex-1 w-full"
        contentClassName="mx-auto w-full max-w-[84rem] grid min-h-full grid-cols-1 gap-[clamp(1.25rem,2vw,2rem)] pb-[2.5rem] lg:grid-cols-[clamp(19rem,28vw,26rem)_minmax(0,1fr)] 2xl:grid-cols-[clamp(22rem,30vw,28rem)_minmax(0,1fr)] items-start"
        safeInsetTop={4}
        safeInsetBottom={8}
      >
        {/* 左栏：封面设置与实例环境摘要（顶端与右侧面板完全齐平） */}
        <div className="flex min-w-0 flex-col gap-[clamp(1rem,1.5vw,1.25rem)]">
          {/* 封面预览卡片 (移除外部顶部文字，顶边直接与右栏配置面板像素对齐) */}
          <FocusItem focusKey="final-config-cover" onEnter={handleSelectCover}>
            {({ ref, focused }) => (
              <div
                ref={ref as any}
                onClick={handleSelectCover}
                className={`group relative aspect-video w-full cursor-pointer overflow-hidden rounded-[0.125rem] border-2 bg-[#141415] text-ore-text-muted transition-colors select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.25)] ${
                  focused
                    ? 'outline outline-[0.1875rem] outline-white outline-offset-[0.125rem] border-white z-10 brightness-110'
                    : 'border-[#1E1E1F] hover:border-white/50 hover:text-white'
                }`}
              >
                {coverImage ? (
                  <>
                    <img
                      src={convertFileSrc(coverImage)}
                      alt="Cover"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center bg-black/65 transition-opacity ${
                        focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Camera size="1.75rem" className="text-ore-green mb-1 drop-shadow" />
                      <span className="font-minecraft text-[0.8125rem] font-bold tracking-widest text-white drop-shadow">
                        点击更换封面
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-[1rem] text-center">
                    <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-white/5 border border-white/10 mb-2 transition-colors group-hover:bg-ore-green/10 group-hover:border-ore-green/30">
                      <Camera
                        size="1.75rem"
                        className="text-ore-text-muted/70 transition-colors group-hover:text-ore-green"
                      />
                    </div>
                    <span className="font-minecraft text-[clamp(0.75rem,0.85vw,0.875rem)] font-bold text-white/90">
                      点击上传自定义封面
                    </span>
                    <span className="mt-1 font-minecraft text-[0.6875rem] text-ore-text-muted/70">
                      支持 PNG, JPG, JPEG, WEBP (16:9)
                    </span>
                  </div>
                )}
              </div>
            )}
          </FocusItem>

          {/* 实例摘要卡片 */}
          <div className="flex flex-col gap-[clamp(0.75rem,1vw,0.875rem)] rounded-[0.125rem] border-2 border-[#1E1E1F] bg-[#2A2B2D] p-[clamp(1rem,1.5vw,1.25rem)] shadow-[inset_0_2px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-white/5 pb-[0.5rem]">
              <span className="flex items-center font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow select-none">
                <Box size="1rem" className="mr-[0.5rem] text-ore-green flex-shrink-0" /> 实例摘要
              </span>
              <span className="rounded-[0.125rem] border border-ore-green/30 bg-ore-green/15 px-2 py-0.5 font-minecraft text-[0.6875rem] font-bold text-ore-green">
                独立版本隔离
              </span>
            </div>

            {/* 核心版本行 */}
            <div className="flex min-w-0 items-center justify-between gap-[1rem]">
              <span className="font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] text-[#A0A0A0]">
                核心版本
              </span>
              <span className="truncate rounded-[0.125rem] border border-white/10 bg-black/45 px-2.5 py-1 font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow">
                {gameVersion || '未选择'}
              </span>
            </div>

            <div className="h-[2px] w-full border-b border-white/5 bg-[#1E1E1F]" />

            {/* 运行环境行 */}
            <div className="flex min-w-0 items-center justify-between gap-[1rem]">
              <span className="font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] text-[#A0A0A0]">
                运行环境
              </span>
              <span className="flex min-w-0 items-center truncate rounded-[0.125rem] border border-white/10 bg-black/45 px-2.5 py-1 font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow">
                <Layers size="0.875rem" className="mr-1.5 flex-shrink-0 text-ore-green opacity-90" />
                {loaderType === 'Vanilla' ? '纯净原版' : `${loaderType} ${loaderVersion || ''}`}
              </span>
            </div>
          </div>
        </div>

        {/* 右栏：配置表单区 */}
        <div className="flex min-w-0 flex-col gap-[clamp(1.25rem,1.8vw,1.75rem)] rounded-[0.125rem] border-2 border-[#1E1E1F] bg-[#2A2B2D] p-[clamp(1.25rem,2vw,1.75rem)] shadow-[inset_0_2px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.25)]">
          {/* 表单项 1: 实例显示名称 */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="flex items-center justify-between">
              <label className="flex items-center font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow select-none">
                <Info size="1rem" className="mr-[0.5rem] text-ore-green flex-shrink-0" /> 实例显示名称
              </label>
              <span className="font-minecraft text-[0.75rem] text-ore-text-muted select-none">
                在实例列表中展示的名称
              </span>
            </div>
            <OreInput
              focusKey="final-config-name"
              value={instanceName}
              onChange={(event) => setInstanceName(event.target.value)}
              placeholder={folderName || '输入实例显示名称...'}
              height="clamp(2.75rem, 3.2vw, 3.25rem)"
              className="!text-[clamp(0.875rem,0.95vw,1rem)]"
              prefixNode={<Sparkles size={16} />}
            />
          </div>

          {/* 表单项 2: 文件夹名称（系统生成只读） */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="flex items-center justify-between">
              <label className="flex items-center font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow select-none">
                <Folder size="1rem" className="mr-[0.5rem] text-ore-green flex-shrink-0" /> 文件夹名称
              </label>
              <span className="font-minecraft text-[0.75rem] text-ore-text-muted/80 select-none">
                系统根据名称自动生成的物理目录
              </span>
            </div>
            <OreInput
              focusKey="final-config-folder-name"
              value={folderName}
              readOnly
              disabled
              height="clamp(2.75rem, 3.2vw, 3.25rem)"
              className="!text-[clamp(0.875rem,0.95vw,1rem)] cursor-not-allowed opacity-80"
              prefixNode={<Folder size={16} />}
            />
          </div>

          {/* 表单项 3: 实例保存路径 */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="flex items-center justify-between">
              <label className="flex items-center font-minecraft text-[clamp(0.8125rem,0.9vw,0.9375rem)] font-bold text-white ore-text-shadow select-none">
                <HardDrive size="1rem" className="mr-[0.5rem] text-ore-green flex-shrink-0" /> 实例保存路径
              </label>
              <span className="font-minecraft text-[0.75rem] text-ore-text-muted select-none">
                游戏核心数据与资源存储目录
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-stretch">
              <div className="flex-1 min-w-0">
                <OreInput
                  focusKey="final-config-path"
                  value={save_path}
                  onChange={(event) => setSavePath(event.target.value)}
                  height="clamp(2.75rem, 3.2vw, 3.25rem)"
                  className="!text-[clamp(0.8125rem,0.9vw,0.9375rem)]"
                  prefixNode={<HardDrive size={16} />}
                />
              </div>
              <FocusItem focusKey="final-config-btn-browse" onEnter={handleSelectFolder}>
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    className={`flex-shrink-0 ${focused ? 'ring-2 ring-white rounded-sm' : ''}`}
                  >
                    <OreButton
                      variant="secondary"
                      size="auto"
                      className="!h-[clamp(2.75rem,3.2vw,3.25rem)] px-5 !m-0 w-full sm:w-auto flex items-center justify-center gap-1.5 font-minecraft"
                      onClick={handleSelectFolder}
                    >
                      <FolderOpen size="1rem" /> 浏览
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>
          </div>
        </div>
      </OreOverlayScrollArea>
    </div>
  );
};

