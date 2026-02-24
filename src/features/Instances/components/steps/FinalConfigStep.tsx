// /src/features/Instances/components/steps/FinalConfigStep.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../../style/tokens/motion';
import { Camera, Folder, HardDrive, Info, Pickaxe, Box, Layers } from 'lucide-react';
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';

// 引入 Tauri 原生 API
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

type StepProps = ReturnType<typeof useCustomInstance>;

export const FinalConfigStep: React.FC<StepProps> = ({
  gameVersion, loaderType, loaderVersion, 
  instanceName, setInstanceName, folderName, save_path, setSavePath, 
  coverImage, setCoverImage, handlePrevStep, handleCreate
}) => {
  const inputBase = "w-full bg-[#1E1E1F] border-2 border-ore-gray-border p-3 font-minecraft text-white focus:outline-none focus:border-white transition-colors";

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
      console.error("图片选择失败:", error);
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
      console.error("文件夹选择失败:", error);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pt-4 min-h-0">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-minecraft text-white ore-text-shadow">完善信息</h2>
          <p className="text-ore-text-muted font-minecraft text-sm mt-1 tracking-widest">Step 3: 设置实例外观与存放位置</p>
        </div>
        <div className="flex space-x-4">
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={handleCreate}>
            <Pickaxe size={18} className="mr-2" /> 开始创建
          </OreButton>
        </div>
      </div>

      <div className="flex flex-1 gap-8 min-h-0">
        {/* === 左侧：封面与信息摘要 === */}
        <div className="w-1/3 flex flex-col space-y-6">
          
          {/* 1. 封面选择模块 (✅ 修复：统一为 space-y-2) */}
          <div className="space-y-2">
            <label className="text-ore-text-muted font-minecraft text-xs flex items-center">
              <Camera size={14} className="mr-2" /> 封面预览
            </label>
            <motion.div 
              onClick={handleSelectCover} 
              whileHover={OreMotionTokens.subtleHover} 
              className="aspect-video bg-[#1E1E1F] border-2 border-ore-gray-border flex flex-col items-center justify-center text-ore-text-muted cursor-pointer hover:text-white transition-colors overflow-hidden relative group"
            >
              {coverImage ? (
                <>
                  <img src={convertFileSrc(coverImage)} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="font-minecraft text-sm tracking-widest text-white">点击更换</span>
                  </div>
                </>
              ) : (
                <>
                  <Camera size={32} />
                  <span className="text-[10px] mt-2 font-minecraft tracking-widest">点击上传自定义封面</span>
                </>
              )}
            </motion.div>
          </div>

          {/* 2. 实例信息摘要模块 (✅ 修复：统一为 space-y-2) */}
          <div className="space-y-2">
            <label className="text-ore-text-muted font-minecraft text-xs flex items-center">
              <Box size={14} className="mr-2" /> 实例摘要
            </label>
            <div className="bg-[#1E1E1F] border-2 border-ore-gray-border p-4 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-ore-text-muted font-minecraft text-sm">核心版本:</span>
                <span className="text-white font-minecraft text-sm font-bold">{gameVersion}</span>
              </div>
              <div className="w-full h-[2px] bg-ore-gray-border/50"></div>
              <div className="flex items-center justify-between">
                <span className="text-ore-text-muted font-minecraft text-sm">运行环境:</span>
                <span className="text-white font-minecraft text-sm font-bold flex items-center">
                  <Layers size={14} className="mr-1.5 opacity-70" />
                  {loaderType === 'Vanilla' ? '纯净原版' : `${loaderType} ${loaderVersion}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* === 右侧：表单配置 === */}
        <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2 min-h-0">
          <div className="space-y-2">
            <label className="text-ore-text-muted font-minecraft text-xs flex items-center">
              <Info size={14} className="mr-2" /> 实例显示名称
            </label>
            <input 
              className={inputBase} 
              value={instanceName} 
              onChange={e => setInstanceName(e.target.value)} 
              placeholder={folderName} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-ore-text-muted font-minecraft text-xs flex items-center">
              <Folder size={14} className="mr-2" /> 文件夹名称 (由系统自动计算)
            </label>
            <input 
              className={`${inputBase} opacity-50 cursor-not-allowed`} 
              value={folderName} 
              readOnly 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-ore-text-muted font-minecraft text-xs flex items-center">
              <HardDrive size={14} className="mr-2" /> 保存路径
            </label>
            <div className="flex space-x-2">
              <input 
                className={inputBase} 
                value={save_path} 
                onChange={e => setSavePath(e.target.value)} 
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