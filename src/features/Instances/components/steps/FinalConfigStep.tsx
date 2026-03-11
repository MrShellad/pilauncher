import React from 'react';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Box, Camera, Folder, HardDrive, Info, Layers, Pickaxe } from 'lucide-react';

import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { OreButton } from '../../../../ui/primitives/OreButton';

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
    'w-full border-2 border-ore-gray-border bg-[#1E1E1F] p-3 font-minecraft text-white transition-colors focus:border-white focus:outline-none';

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
    <div className="mx-auto flex h-full w-full max-w-5xl min-h-0 flex-col pt-4">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="ore-text-shadow font-minecraft text-2xl text-white">完善信息</h2>
          <p className="mt-1 font-minecraft text-sm tracking-widest text-ore-text-muted">
            Step 3: 设置实例外观与存放位置
          </p>
        </div>
        <div className="flex space-x-4">
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={() => { void handleCreate(); }}>
            <Pickaxe size={18} className="mr-2" /> 开始创建
          </OreButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-8">
        <div className="flex w-1/3 flex-col space-y-6">
          <div className="space-y-2">
            <label className="flex items-center font-minecraft text-xs text-ore-text-muted">
              <Camera size={14} className="mr-2" /> 封面预览
            </label>
            <motion.div
              onClick={handleSelectCover}
              whileHover={OreMotionTokens.subtleHover}
              className="group relative aspect-video cursor-pointer overflow-hidden border-2 border-ore-gray-border bg-[#1E1E1F] text-ore-text-muted transition-colors hover:text-white"
            >
              {coverImage ? (
                <>
                  <img src={convertFileSrc(coverImage)} alt="Cover" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="font-minecraft text-sm tracking-widest text-white">点击更换</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <Camera size={32} />
                  <span className="mt-2 font-minecraft text-[10px] tracking-widest">点击上传自定义封面</span>
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center font-minecraft text-xs text-ore-text-muted">
              <Box size={14} className="mr-2" /> 实例摘要
            </label>
            <div className="flex flex-col space-y-3 border-2 border-ore-gray-border bg-[#1E1E1F] p-4">
              <div className="flex items-center justify-between">
                <span className="font-minecraft text-sm text-ore-text-muted">核心版本:</span>
                <span className="font-minecraft text-sm font-bold text-white">{gameVersion}</span>
              </div>
              <div className="h-[2px] w-full bg-ore-gray-border/50" />
              <div className="flex items-center justify-between">
                <span className="font-minecraft text-sm text-ore-text-muted">运行环境:</span>
                <span className="flex items-center font-minecraft text-sm font-bold text-white">
                  <Layers size={14} className="mr-1.5 opacity-70" />
                  {loaderType === 'Vanilla' ? '纯净原版' : `${loaderType} ${loaderVersion}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2 no-scrollbar">
          <div className="space-y-2">
            <label className="flex items-center font-minecraft text-xs text-ore-text-muted">
              <Info size={14} className="mr-2" /> 实例显示名称
            </label>
            <input
              className={inputBase}
              value={instanceName}
              onChange={(event) => setInstanceName(event.target.value)}
              placeholder={folderName}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center font-minecraft text-xs text-ore-text-muted">
              <Folder size={14} className="mr-2" /> 文件夹名称（系统自动计算）
            </label>
            <input className={`${inputBase} cursor-not-allowed opacity-50`} value={folderName} readOnly />
          </div>

          <div className="space-y-2">
            <label className="flex items-center font-minecraft text-xs text-ore-text-muted">
              <HardDrive size={14} className="mr-2" /> 保存路径
            </label>
            <div className="flex space-x-2">
              <input
                className={inputBase}
                value={save_path}
                onChange={(event) => setSavePath(event.target.value)}
              />
              <OreButton variant="secondary" size="auto" onClick={handleSelectFolder}>
                浏览
              </OreButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
