// /src/features/Instances/components/LocalImportView.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderArchive, FileArchive, CheckCircle2, AlertTriangle, HardDrive, Cpu, Blocks, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useDownloadStore } from '../../../store/useDownloadStore';

interface ModpackMetadata {
  name: string;
  version: string;     
  loader: string;      
  loaderVersion: string;
  author: string;
  source: 'CurseForge' | 'Modrinth' | 'HMCL' | 'Unknown';
}

export const LocalImportView: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  
  const [instanceName, setInstanceName] = useState('');
  const [installPath, setInstallPath] = useState('正在获取目录...'); // ✅ 初始状态改为加载中
  const [isImporting, setIsImporting] = useState(false);

  // ✅ 核心适配：组件挂载时，调用 Rust 后端获取真实的基础数据目录
  useEffect(() => {
    const fetchBasePath = async () => {
      try {
        // 调用 config_cmd.rs 中暴露的 get_base_directory 命令
        const basePath = await invoke<string | null>('get_base_directory');
        
        if (basePath) {
          // 智能判断 Windows(\) 或 macOS/Linux(/) 的路径分隔符，并拼接 instances 目录
          const separator = basePath.includes('\\') ? '\\' : '/';
          setInstallPath(`${basePath}${separator}instances`);
        } else {
          setInstallPath('未配置基础目录，请前往设置配置');
        }
      } catch (e) {
        console.error('获取基础目录失败:', e);
        setInstallPath('无法读取默认目录');
      }
    };
    
    fetchBasePath();
  }, []);

  // 1. 触发文件选择与解析
  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Minecraft 整合包', extensions: ['zip', 'mrpack'] }]
      });

      if (selected && typeof selected === 'string') {
        setSelectedPath(selected);
        setIsParsing(true);

        try {
          const parsedData: ModpackMetadata = await invoke('parse_modpack_metadata', { path: selected });
          setMetadata(parsedData);
          setInstanceName(parsedData.name); 
          setIsParsing(false);
          setStep(2); 
        } catch (parseError) {
          setIsParsing(false);
          alert(`解析失败: ${parseError}`);
        }
      }
    } catch (err) {
      console.error("文件选择或解析失败:", err);
      setIsParsing(false);
    }
  };

  // 2. 选择自定义安装目录
  const handleSelectPath = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setInstallPath(selected);
    }
  };

  // 3. 执行导入
const handleStartImport = async () => {
    setIsImporting(true);
    try {
      // 1. 触发后端的异步导入任务
      await invoke('import_modpack', { 
        zipPath: selectedPath, 
        instanceName: instanceName 
      });

      setIsImporting(false);
      
      // 2. ✅ 跨页联动：瞬间跳回首页，并自动弹出右下角的任务面板
      useLauncherStore.getState().setActiveTab('home');
      useDownloadStore.getState().setPopupOpen(true);
      
    } catch (err) {
      console.error("导入请求发送失败:", err);
      setIsImporting(false);
      alert(`导入失败: ${err}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white px-8">
      <AnimatePresence mode="wait">
        
        {/* ================= 步骤 1：选择文件 ================= */}
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center max-w-lg w-full"
          >
            <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
              {isParsing ? <Loader2 size={40} className="text-ore-green animate-spin" /> : <FolderArchive size={40} className="text-ore-text-muted" />}
            </div>
            <h2 className="font-minecraft text-2xl mb-2 tracking-widest">
              {isParsing ? '正在读取元数据...' : '导入本地整合包'}
            </h2>
            <p className="text-[#A0A0A0] text-sm mb-8 text-center font-minecraft leading-relaxed">
              支持导入从 CurseForge 下载的 <span className="text-white font-bold">.zip</span> 或从 Modrinth 下载的 <span className="text-white font-bold">.mrpack</span> 格式文件。<br/>
              启动器会自动解析配置并补全所需的游戏核心。
            </p>

            <FocusItem focusKey="btn-select-zip" onEnter={handleSelectFile}>
              {({ ref, focused }) => (
                <div ref={ref} className={`rounded-sm transition-shadow ${focused ? 'outline outline-[3px] outline-offset-[4px] outline-white' : ''}`}>
                  <OreButton variant="primary" size="lg" onClick={handleSelectFile} disabled={isParsing} tabIndex={-1}>
                    <FileArchive size={20} className="mr-2" />
                    选择整合包文件
                  </OreButton>
                </div>
              )}
            </FocusItem>
          </motion.div>
        )}

        {/* ================= 步骤 2：确认信息与环境补全 ================= */}
        {step === 2 && metadata && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col w-full max-w-2xl bg-[#1E1E1F] border-2 border-[#2A2A2C] shadow-2xl p-6"
          >
            <div className="flex items-start justify-between border-b-2 border-white/5 pb-4 mb-4">
              <div>
                <h3 className="font-minecraft text-2xl text-white mb-1 flex items-center">
                  <CheckCircle2 size={24} className="text-ore-green mr-2" />
                  解析成功: {metadata.name}
                </h3>
                <span className="text-xs text-ore-text-muted bg-black/40 px-2 py-0.5 rounded-sm border border-white/10">
                  包来源：{metadata.source} | 作者：{metadata.author}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/30 p-3 flex items-center border border-white/5">
                <Blocks size={24} className="text-blue-400 mr-3 opacity-80" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-ore-text-muted uppercase tracking-wider">游戏版本</span>
                  <span className="font-minecraft text-white">Minecraft {metadata.version}</span>
                </div>
              </div>
              <div className="bg-black/30 p-3 flex items-center border border-white/5">
                <Cpu size={24} className="text-orange-400 mr-3 opacity-80" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-ore-text-muted uppercase tracking-wider">模组加载器</span>
                  <span className="font-minecraft text-white">{metadata.loader} {metadata.loaderVersion}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-ore-text-muted font-bold tracking-wider">实例名称 (可修改)</label>
                <input 
                  type="text" 
                  value={instanceName} 
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="bg-black/40 border border-[#2A2A2C] text-white px-3 py-2 font-minecraft focus:outline-none focus:border-white/50 transition-colors"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-ore-text-muted font-bold tracking-wider">安装路径 (默认读取全局配置)</label>
                <div className="flex space-x-2">
                  {/* ✅ 这里会直接显示例如 G:\Games\PiLauncher\instances */}
                  <div 
                    className="flex-1 bg-black/40 border border-[#2A2A2C] text-gray-400 px-3 py-2 font-minecraft text-sm truncate"
                    title={installPath}
                  >
                    {installPath}
                  </div>
                  <FocusItem focusKey="btn-change-path" onEnter={handleSelectPath}>
                    {({ ref, focused }) => (
                      <button 
                        ref={ref} onClick={handleSelectPath} 
                        className={`px-4 bg-[#2A2A2C] hover:bg-[#3A3B3D] text-white font-minecraft transition-colors focus:outline-none ${focused ? 'outline outline-2 outline-offset-2 outline-white' : ''}`}
                      >
                        更改
                      </button>
                    )}
                  </FocusItem>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start mb-8">
              <AlertTriangle size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-500/90 leading-relaxed font-minecraft">
                系统检测到该整合包依赖 <span className="text-white font-bold">{metadata.version}</span> 和 <span className="text-white font-bold">{metadata.loader}</span> 环境。<br/>
                如果本地缺失，将在导入完成后自动为您在后台下载补充。
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-auto">
              <FocusItem focusKey="btn-cancel-import" onEnter={() => setStep(1)}>
                {({ ref, focused }) => (
                  <div ref={ref} className={`rounded-sm ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : ''}`}>
                    <OreButton variant="secondary" onClick={() => setStep(1)} tabIndex={-1}>取消</OreButton>
                  </div>
                )}
              </FocusItem>
              
              <FocusItem focusKey="btn-confirm-import" onEnter={handleStartImport}>
                {({ ref, focused }) => (
                  <div ref={ref} className={`rounded-sm ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : ''}`}>
                    <OreButton variant="primary" onClick={handleStartImport} disabled={isImporting} tabIndex={-1}>
                      {isImporting ? <Loader2 size={18} className="animate-spin mr-2" /> : <HardDrive size={18} className="mr-2" />}
                      {isImporting ? '正在导入与补全...' : '确认导入'}
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};