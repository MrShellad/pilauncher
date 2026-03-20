// src/features/InstanceDetail/components/tabs/export/ExportConfirmStep.tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, CheckCircle2, Loader2, List, Folder, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { DirectoryBrowserModal } from '../../../../../ui/components/DirectoryBrowserModal';
import type { ExportData } from './ExportPanel';

interface ExportConfirmStepProps {
  instanceId: string;
  data: ExportData;
  onBack: () => void;
}

interface ExportProgress {
  current: number;
  total: number;
  message: string;
  stage: string;
}

export const ExportConfirmStep: React.FC<ExportConfirmStepProps> = ({ instanceId, data, onBack }) => {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [outputDir, setOutputDir] = useState<string>('');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  useEffect(() => {
    const initOutputDir = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const sep = basePath.includes('\\') ? '\\' : '/';
          const defaultOut = `${basePath}${sep}export`;
          
          try {
            await invoke('create_valid_dir', { parent: basePath, name: 'export' });
          } catch (e) {
            // Silently ignore if it already exists or fails
          }

          setOutputDir(defaultOut);
        }
      } catch (e) {
        console.error('Failed to get default output path:', e);
      }
    };
    initOutputDir();
  }, []);

  useEffect(() => {
    const unlisten = listen<ExportProgress>('export-progress', (event) => {
      setProgress(event.payload);
      if (event.payload.stage === 'DONE') {
        setStatus('success');
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleStartExport = async () => {
    if (!outputDir) return;
    try {
      const ext = data.format === 'mrpack' ? 'mrpack' : 'zip';
      const outputPath = await join(outputDir, `${data.name}-${data.version}.${ext}`);
      
      const additionalStrings = data.additionalPaths.map(p => p.path);

      setStatus('exporting');
      
      await invoke('export_modpack', {
        config: {
          instanceId: instanceId,
          name: data.name,
          version: data.version,
          author: data.author,
          description: data.description,
          format: data.format,
          manifestMode: data.manifestMode,
          includeMods: data.includeMods,
          includeConfigs: data.includeConfigs,
          includeResourcePacks: data.includeResourcePacks,
          includeShaderPacks: data.includeShaderPacks,
          includeSaves: data.includeSaves,
          additionalPaths: additionalStrings,
          outputPath: outputPath
        }
      });

    } catch (err: any) {
      console.error('Export failed:', err);
      setStatus('error');
      setErrorMessage(err.toString());
    }
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const getBasename = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  const contentList = [
    data.includeMods && 'MODS',
    data.includeConfigs && 'CONFIG',
    data.includeResourcePacks && 'RESOURCE PACKS',
    data.includeShaderPacks && 'SHADER PACKS',
    data.includeSaves && 'SAVES',
    ...data.additionalPaths.map(p => getBasename(p.path))
  ].filter(Boolean);

  return (
    <div className="flex flex-col space-y-4 h-full">
      <div className="flex items-center space-x-3 border-b-2 border-[#18181B] pb-3 shrink-0">
        <span className="w-1.5 h-4 bg-[#3C8527] shadow-[0_0_8px_rgba(56,133,39,0.4)]" />
        <div>
          <h3 className="text-lg font-bold tracking-widest text-white">最终确认</h3>
          <p className="text-xs text-[#B1B2B5] tracking-wider">检查配置参数并执行打包</p>
        </div>
      </div>

      {status === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1 flex-1 min-h-0">
          
          <div className="bg-[#1E1E1F] p-5 border-2 border-[#18181B] flex flex-col shadow-[inset_2px_2px_rgba(255,255,255,0.05)] h-full">
            <div className="flex items-center text-sm text-[#D0D1D4] font-bold uppercase tracking-widest pb-3 border-b-2 border-[#18181B] shrink-0">
              <List size={18} className="mr-2 text-[#B1B2B5]" />
              参数摘要
            </div>
            <div className="space-y-4 pt-4 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#B1B2B5]">名称:</span>
                <span className="font-bold text-white tracking-wide truncate max-w-[160px]">{data.name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#B1B2B5]">版本:</span>
                <span className="font-bold text-[#E6E8EB]">{data.version}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#B1B2B5]">目标格式:</span>
                <span className="font-bold text-[#3C8527] uppercase drop-shadow-[0_0_2px_rgba(60,133,39,0.5)] bg-[#313233] px-2 py-0.5 rounded-sm border border-[#18181B]">{data.format}</span>
              </div>
              
              <div className="flex flex-col text-sm pt-4 border-t-2 border-[#18181B] flex-1 min-h-0">
                <span className="text-[#B1B2B5] mb-3 shrink-0">包含的内容:</span>
                <div className="flex overflow-x-auto whitespace-nowrap custom-scrollbar pb-2 gap-2 items-start shrink-0">
                  {contentList.length > 0 ? (
                    contentList.map(item => (
                      <span key={item as string} className="px-3 py-1 bg-[#2A2A2C] border border-[#18181B] text-xs font-bold rounded-full text-[#D0D1D4] shadow-[inset_1px_1px_rgba(255,255,255,0.05)] shrink-0">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-bold text-[#C33636]">无 (空的整合包)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between h-full space-y-4">
            <div className="bg-[#1E1E1F] p-5 border-2 border-[#18181B] flex flex-col space-y-3 shadow-[inset_2px_2px_rgba(255,255,255,0.05)] shrink-0">
              <span className="text-[#B1B2B5] text-sm font-bold flex items-center">
                <Folder size={16} className="mr-2" />
                导出目的地
              </span>
              <div className="flex gap-2 items-center bg-[#141415] border border-[#2A2A2C] p-2 rounded-sm shadow-inner group">
                <span className="text-[#D0D1D4] text-xs flex-1 break-all leading-normal" title={outputDir}>
                  {outputDir || '正在获取默认路径...'}
                </span>
                <OreButton size="sm" variant="secondary" className="shrink-0" onClick={() => setIsBrowserOpen(true)}>
                  更改路径
                </OreButton>
              </div>
            </div>
            
            <div className="flex-1 min-h-0" />
            
            <div className="h-14 shrink-0">
              <OreButton disabled={!outputDir || contentList.length === 0} variant="primary" size="full" onClick={handleStartExport} className="flex items-center justify-center text-xl shadow-[0_4px_10px_rgba(60,133,39,0.3)]">
                <Download size={20} className="mr-3" />
                立即执行打包
              </OreButton>
            </div>
          </div>
        </div>
      )}

      {(status === 'exporting' || status === 'success') && (
        <div className="bg-[#1E1E1F] flex-1 border-2 border-[#18181B] p-8 flex flex-col items-center justify-center space-y-8 rounded-sm shadow-[inset_2px_2px_rgba(255,255,255,0.05),inset_0_20px_50px_rgba(0,0,0,0.5)]">
          {status === 'exporting' ? (
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <Loader2 size={80} className="text-[#3C8527] animate-spin drop-shadow-[0_0_15px_rgba(60,133,39,0.8)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Download size={32} className="text-[#E6E8EB] animate-bounce" />
              </div>
            </div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 shrink-0 bg-[#3C8527] border-2 border-[#18181B] rounded-full flex items-center justify-center shadow-[inset_4px_4px_rgba(255,255,255,0.3),0_0_30px_rgba(60,133,39,0.6)]">
              <CheckCircle2 size={40} className="text-white drop-shadow-md" />
            </motion.div>
          )}

          <div className="text-center space-y-2 shrink-0 w-full">
            <h4 className="text-xl font-bold tracking-widest uppercase text-white ore-text-shadow">
              {status === 'exporting' ? '正在执行打包程序...' : '导出完毕!'}
            </h4>
            <p className="text-xs text-[#B1B2B5] tracking-widest uppercase truncate max-w-[400px] mx-auto">
              {progress?.message || 'PREPARING TO LAUNCH...'}
            </p>
          </div>

          <div className="w-full max-w-md space-y-2 mt-4 relative shrink-0">
            <div className="h-4 bg-[#18181B] border-2 border-[#333334] rounded-full overflow-hidden shadow-inner flex">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${percent}%` }}
                 className="h-full bg-[#3C8527] shadow-[inset_0_2px_rgba(255,255,255,0.3),inset_0_-2px_rgba(0,0,0,0.2)] bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,.15)25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]"
                 style={{ animation: 'progress-stripes 2s linear infinite' }}
               />
            </div>
            
            <div className="flex justify-between text-[10px] text-[#A1A3A5] font-bold uppercase tracking-widest relative">
              <div className="absolute top-1 left-0 z-10 bg-[#1E1E1F] px-2">{progress?.stage || 'QUEUE'}</div>
              <div className="absolute top-1 right-0 z-10 bg-[#1E1E1F] px-2 text-[#3C8527]">{percent}%</div>
            </div>
            <style>{`
              @keyframes progress-stripes {
                from { background-position: 20px 0; }
                to { background-position: 0 0; }
              }
            `}</style>
          </div>

          {status === 'success' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 flex gap-4 shrink-0">
              <OreButton variant="secondary" onClick={() => invoke('show_in_folder', { path: outputDir })} size="lg">
                <ExternalLink size={18} className="mr-2" />
                打开所在目录
              </OreButton>
              <OreButton variant="primary" onClick={() => onBack()} size="lg">
                返回详情页
              </OreButton>
            </motion.div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-[#C33636] border-4 border-[#AD1D1D] p-10 flex-1 flex flex-col items-center justify-center space-y-6 text-center rounded-sm shadow-[inset_2px_2px_rgba(255,255,255,0.2),0_10px_30px_rgba(195,54,54,0.4)]">
          <AlertTriangle size={64} className="text-white drop-shadow-lg shrink-0" />
          <div className="space-y-2 pb-4 shrink-0 overflow-y-auto">
            <h4 className="text-2xl font-bold tracking-widest uppercase text-white ore-text-shadow">打包任务异常终止</h4>
            <p className="text-sm text-white max-w-md break-all font-bold bg-[#AD1D1D] p-4 border border-[#8B0000] shadow-inner text-left max-h-[150px] overflow-y-auto custom-scrollbar">
              {errorMessage}
            </p>
          </div>
          <OreButton variant="secondary" onClick={() => setStatus('idle')} size="lg" className="ring-2 ring-white shrink-0">
            查阅并重试
          </OreButton>
        </div>
      )}

      <DirectoryBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={(path) => {
          setOutputDir(path);
          setIsBrowserOpen(false);
        }}
        initialPath={outputDir}
      />
    </div>
  );
};
