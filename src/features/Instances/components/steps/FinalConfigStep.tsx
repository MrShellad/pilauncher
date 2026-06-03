import React from 'react';
import { motion } from 'motion/react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Box, Camera, Folder, HardDrive, Info, Layers, Pickaxe } from 'lucide-react';

import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
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
  const inputBase =
    'min-h-[2.75rem] w-full min-w-0 border-[0.125rem] border-ore-gray-border bg-[#1E1E1F] px-[0.75rem] py-[0.625rem] font-minecraft text-[0.875rem] leading-[1.25rem] text-white transition-colors placeholder:text-ore-text-muted/80 focus:border-white focus:outline-none';

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
      <div className={STEP_HEADER_LARGE_CLASS}>
        <div>
          <h2 className={STEP_TITLE_CLASS}>完善信息</h2>
          <p className={STEP_SUBTITLE_CLASS}>
            Step 3: 设置实例外观与存放位置
          </p>
        </div>
        <div className={STEP_ACTIONS_CLASS}>
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={() => { void handleCreate(); }}>
            <Pickaxe size="1.125rem" className="mr-[0.5rem]" /> 开始创建
          </OreButton>
        </div>
      </div>

      <OreOverlayScrollArea
        className="min-h-0 flex-1"
        contentClassName="grid min-h-full grid-cols-1 gap-[2rem] pb-[2rem] lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]"
        safeInsetTop={4}
        safeInsetBottom={8}
      >
        <div className="flex min-w-0 flex-col space-y-[1.5rem]">
          <div className="space-y-[0.5rem]">
            <label className="flex items-center font-minecraft text-[0.75rem] leading-[1rem] text-ore-text-muted">
              <Camera size="0.875rem" className="mr-[0.5rem]" /> 封面预览
            </label>
            <motion.div
              onClick={handleSelectCover}
              whileHover={OreMotionTokens.subtleHover}
              className="group relative aspect-video cursor-pointer overflow-hidden border-[0.125rem] border-ore-gray-border bg-[#1E1E1F] text-ore-text-muted transition-colors hover:text-white"
            >
              {coverImage ? (
                <>
                  <img src={convertFileSrc(coverImage)} alt="Cover" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="font-minecraft text-[0.875rem] leading-[1.25rem] tracking-widest text-white">点击更换</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <Camera size="2rem" />
                  <span className="mt-[0.5rem] font-minecraft text-[0.75rem] leading-[1rem] tracking-widest">点击上传自定义封面</span>
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-[0.5rem]">
            <label className="flex items-center font-minecraft text-[0.75rem] leading-[1rem] text-ore-text-muted">
              <Box size="0.875rem" className="mr-[0.5rem]" /> 实例摘要
            </label>
            <div className="flex flex-col space-y-[0.75rem] border-[0.125rem] border-ore-gray-border bg-[#1E1E1F] p-[1rem]">
              <div className="flex min-w-0 items-center justify-between gap-[1rem]">
                <span className="font-minecraft text-[0.875rem] leading-[1.25rem] text-ore-text-muted">核心版本:</span>
                <span className="truncate font-minecraft text-[0.875rem] font-bold leading-[1.25rem] text-white">{gameVersion}</span>
              </div>
              <div className="h-[0.125rem] w-full bg-ore-gray-border/60" />
              <div className="flex min-w-0 items-center justify-between gap-[1rem]">
                <span className="font-minecraft text-[0.875rem] leading-[1.25rem] text-ore-text-muted">运行环境:</span>
                <span className="flex min-w-0 items-center truncate font-minecraft text-[0.875rem] font-bold leading-[1.25rem] text-white">
                  <Layers size="0.875rem" className="mr-[0.375rem] opacity-80" />
                  {loaderType === 'Vanilla' ? '纯净原版' : `${loaderType} ${loaderVersion}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0 space-y-[1.5rem]">
          <div className="space-y-[0.5rem]">
            <label className="flex items-center font-minecraft text-[0.75rem] leading-[1rem] text-ore-text-muted">
              <Info size="0.875rem" className="mr-[0.5rem]" /> 实例显示名称
            </label>
            <input
              className={inputBase}
              value={instanceName}
              onChange={(event) => setInstanceName(event.target.value)}
              placeholder={folderName}
            />
          </div>

          <div className="space-y-[0.5rem]">
            <label className="flex items-center font-minecraft text-[0.75rem] leading-[1rem] text-ore-text-muted">
              <Folder size="0.875rem" className="mr-[0.5rem]" /> 文件夹名称（系统自动计算）
            </label>
            <input className={`${inputBase} cursor-not-allowed bg-[#242425] text-ore-text-muted`} value={folderName} readOnly />
          </div>

          <div className="space-y-[0.5rem]">
            <label className="flex items-center font-minecraft text-[0.75rem] leading-[1rem] text-ore-text-muted">
              <HardDrive size="0.875rem" className="mr-[0.5rem]" /> 保存路径
            </label>
            <div className="flex min-w-0 flex-col gap-[0.5rem] sm:flex-row">
              <input
                className={inputBase}
                value={save_path}
                onChange={(event) => setSavePath(event.target.value)}
              />
              <OreButton variant="secondary" size="auto" className="sm:flex-shrink-0" onClick={handleSelectFolder}>
                浏览
              </OreButton>
            </div>
          </div>
        </div>
      </OreOverlayScrollArea>
    </div>
  );
};
