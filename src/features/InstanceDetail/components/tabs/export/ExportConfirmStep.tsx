import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Folder,
  List,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join } from '@tauri-apps/api/path';

import { DirectoryBrowserModal } from '../../../../../ui/components/DirectoryBrowserModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
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

const formatLabels: Record<ExportData['format'], string> = {
  zip: '标准 ZIP',
  curseforge: 'CurseForge',
  mrpack: 'Modrinth (mrpack)',
  pipack: 'PiPack',
};

const getBasename = (path: string) => path.split(/[/\\]/).pop() || path;

export const ExportConfirmStep: React.FC<ExportConfirmStepProps> = ({
  instanceId,
  data,
  onBack,
}) => {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  useEffect(() => {
    const initOutputDir = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const separator = basePath.includes('\\') ? '\\' : '/';
          const defaultOut = `${basePath}${separator}export`;

          try {
            await invoke('create_valid_dir', { parent: basePath, name: 'export' });
          } catch {
            // Ignore when the default export directory already exists.
          }

          setOutputDir(defaultOut);
        }
      } catch (error) {
        console.error('Failed to get default output path:', error);
      }
    };

    void initOutputDir();
  }, []);

  useEffect(() => {
    const unlisten = listen<ExportProgress>('export-progress', (event) => {
      setProgress(event.payload);
      if (event.payload.stage === 'DONE') {
        setStatus('success');
      }
    });

    return () => {
      unlisten.then((cleanup) => cleanup());
    };
  }, []);

  const fileExtension =
    data.format === 'pipack' ? 'pipack' : data.format === 'mrpack' ? 'mrpack' : 'zip';
  const effectiveManifestMode =
    data.format === 'pipack' ? true : data.format === 'zip' ? false : data.manifestMode;
  const outputFileName = `${data.name}-${data.version}.${fileExtension}`;
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const contentList: string[] = [
    data.includeMods ? 'Mods' : '',
    data.includeConfigs ? 'Config' : '',
    data.includeResourcePacks ? 'Resource Packs' : '',
    data.includeShaderPacks ? 'Shader Packs' : '',
    data.includeSaves ? 'Saves' : '',
    ...data.additionalPaths.map(
      (item) => `自定义${item.type === 'dir' ? '目录' : '文件'}: ${getBasename(item.path)}`
    ),
  ].filter(Boolean);

  const manifestSummaryValue =
    data.format === 'pipack'
      ? 'PiPack 强制启用'
      : data.format === 'zip'
        ? '标准 ZIP 不使用 Manifest'
        : effectiveManifestMode
          ? '已启用'
          : '未启用';

  const summaryItems = [
    { label: '整合包名称', value: data.name || '未填写' },
    { label: '版本号', value: data.version || '未填写' },
    { label: '作者', value: data.author || '未填写' },
    { label: '导出格式', value: formatLabels[data.format], accent: 'text-[#3C8527]' },
    {
      label: 'Manifest 模式',
      value: manifestSummaryValue,
    },
    { label: 'Hero Logo', value: data.heroLogo ? '已设置' : '未设置' },
    {
      label: '附加内容',
      value: data.additionalPaths.length > 0 ? `${data.additionalPaths.length} 项` : '无',
    },
  ];

  const handleStartExport = async () => {
    if (!outputDir) return;

    try {
      const outputPath = await join(outputDir, outputFileName);
      const additionalStrings = data.additionalPaths.map((item) => item.path);

      setProgress(null);
      setErrorMessage('');
      setStatus('exporting');

      await invoke('export_modpack', {
        config: {
          instanceId,
          name: data.name,
          version: data.version,
          author: data.author,
          description: data.description,
          format: data.format,
          manifestMode: effectiveManifestMode,
          includeMods: data.includeMods,
          includeConfigs: data.includeConfigs,
          includeResourcePacks: data.includeResourcePacks,
          includeShaderPacks: data.includeShaderPacks,
          includeSaves: data.includeSaves,
          additionalPaths: additionalStrings,
          outputPath,
        },
      });
    } catch (error: any) {
      console.error('Export failed:', error);
      setStatus('error');
      setErrorMessage(error.toString());
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {status === 'idle' && (
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] p-4 shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.05)] sm:p-5 xl:p-6">
            <div className="flex items-center text-sm font-bold uppercase tracking-[0.18em] text-[#D0D1D4]">
              <List size={18} className="mr-2 text-[#B1B2B5]" />
              参数摘要
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-sm border border-[#18181B] bg-[#2A2A2C] px-4 py-3 shadow-[inset_0.0625rem_0.0625rem_rgba(255,255,255,0.05)]"
                  >
                    <div className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#8E8F92]">
                      {item.label}
                    </div>
                    <div
                      className={`mt-2 break-words text-sm leading-6 text-[#E6E8EB] ${
                        item.accent || ''
                      }`}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}

                <div className="rounded-sm border border-[#18181B] bg-[#2A2A2C] px-4 py-3 shadow-[inset_0.0625rem_0.0625rem_rgba(255,255,255,0.05)] sm:col-span-2">
                  <div className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#8E8F92]">
                    描述
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-[#E6E8EB]">
                    {data.description || '未填写说明。'}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border-2 border-[#18181B] bg-[#313233] p-4 shadow-[inset_0_0.25rem_0.5rem_-0.125rem_rgba(0,0,0,0.25)] sm:p-5">
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#D0D1D4]">
                  包含内容
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {contentList.length > 0 ? (
                    contentList.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="inline-flex max-w-full items-center rounded-full border border-[#18181B] bg-[#1E1E1F] px-3 py-1.5 text-xs font-bold leading-5 text-[#D0D1D4] shadow-[inset_0.0625rem_0.0625rem_rgba(255,255,255,0.05)] whitespace-normal break-all"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-bold text-[#C33636]">当前没有勾选任何导出内容。</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
            <div className="rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] p-4 shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.05)] sm:p-5">
              <div className="flex flex-col gap-3 border-b-2 border-[#18181B] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center text-sm font-bold text-[#D0D1D4]">
                  <Folder size={16} className="mr-2 text-[#B1B2B5]" />
                  导出路径
                </div>
                <OreButton
                  size="sm"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setIsBrowserOpen(true)}
                >
                  更改路径
                </OreButton>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
                <div className="min-w-0 rounded-sm border border-[#2A2A2C] bg-[#141415] p-3 shadow-inner">
                  <div className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#8E8F92]">
                    输出目录
                  </div>
                  <div className="mt-1 break-all text-sm leading-6 text-[#E6E8EB]" title={outputDir}>
                    {outputDir || '正在获取默认路径...'}
                  </div>
                </div>

                <div className="min-w-0 rounded-sm border border-[#2A2A2C] bg-[#141415] p-3 shadow-inner">
                  <div className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#8E8F92]">
                    输出文件
                  </div>
                  <div className="mt-1 break-all text-sm leading-6 text-[#D0D1D4]">
                    {outputFileName}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-sm border-2 border-[#18181B] bg-[#313233] p-4 shadow-[inset_0_0.25rem_0.5rem_-0.125rem_rgba(0,0,0,0.25)] sm:p-5">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#D0D1D4]">
                  准备导出
                </div>
                <p className="mt-2 text-xs leading-6 text-[#B1B2B5]">
                  将根据当前参数生成整合包，并写入上方指定的导出目录。
                </p>
              </div>

              <OreButton
                disabled={!outputDir || contentList.length === 0}
                variant="primary"
                size="full"
                onClick={handleStartExport}
                className="min-h-[3.5rem]"
              >
                <Download size={20} className="mr-3" />
                立即执行打包
              </OreButton>
            </div>
          </div>
        </div>
      )}

      {(status === 'exporting' || status === 'success') && (
        <div className="flex flex-1 flex-col items-center justify-center space-y-8 rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] p-8 shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.05),inset_0_1.25rem_3.125rem_rgba(0,0,0,0.5)]">
          {status === 'exporting' ? (
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <Loader2
                size={80}
                className="animate-spin text-[#3C8527] drop-shadow-[0_0_0.9375rem_rgba(60,133,39,0.8)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Download size={32} className="animate-bounce text-[#E6E8EB]" />
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#18181B] bg-[#3C8527] shadow-[inset_0.25rem_0.25rem_rgba(255,255,255,0.3),0_0_1.875rem_rgba(60,133,39,0.6)]"
            >
              <CheckCircle2 size={40} className="text-white drop-shadow-md" />
            </motion.div>
          )}

          <div className="w-full shrink-0 space-y-2 text-center">
            <h4 className="text-xl font-bold uppercase tracking-widest text-white ore-text-shadow">
              {status === 'exporting' ? '正在执行打包流程...' : '导出完成'}
            </h4>
            <p className="mx-auto max-w-[25rem] truncate text-xs uppercase tracking-widest text-[#B1B2B5]">
              {progress?.message || 'PREPARING EXPORT TASK...'}
            </p>
          </div>

          <div className="relative mt-4 w-full max-w-md shrink-0 space-y-2">
            <div className="flex h-4 overflow-hidden rounded-full border-2 border-[#333334] bg-[#18181B] shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                className="h-full bg-[#3C8527] bg-[length:1.25rem_1.25rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] shadow-[inset_0_0.125rem_rgba(255,255,255,0.3),inset_0_-0.125rem_rgba(0,0,0,0.2)]"
                style={{ animation: 'progress-stripes 2s linear infinite' }}
              />
            </div>

            <div className="relative flex justify-between text-[0.625rem] font-bold uppercase tracking-widest text-[#A1A3A5]">
              <div className="absolute left-0 top-1 z-10 bg-[#1E1E1F] px-2">
                {progress?.stage || 'QUEUE'}
              </div>
              <div className="absolute right-0 top-1 z-10 bg-[#1E1E1F] px-2 text-[#3C8527]">
                {percent}%
              </div>
            </div>
            <style>{`
              @keyframes progress-stripes {
                from { background-position: 20px 0; }
                to { background-position: 0 0; }
              }
            `}</style>
          </div>

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex shrink-0 flex-col gap-3 pt-2 sm:flex-row"
            >
              <OreButton
                variant="secondary"
                onClick={() => invoke('show_in_folder', { path: outputDir })}
                size="lg"
              >
                <ExternalLink size={18} className="mr-2" />
                打开所在目录
              </OreButton>
              <OreButton variant="primary" onClick={onBack} size="lg">
                返回导出设置
              </OreButton>
            </motion.div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center space-y-6 rounded-sm border-4 border-[#AD1D1D] bg-[#C33636] p-10 text-center shadow-[inset_0.125rem_0.125rem_rgba(255,255,255,0.2),0_0.625rem_1.875rem_rgba(195,54,54,0.4)]">
          <AlertTriangle size={64} className="shrink-0 text-white drop-shadow-lg" />
          <div className="shrink-0 space-y-2 overflow-y-auto pb-4">
            <h4 className="text-2xl font-bold uppercase tracking-widest text-white ore-text-shadow">
              打包任务异常终止
            </h4>
            <p className="max-h-[9.375rem] max-w-md overflow-y-auto break-all border border-[#8B0000] bg-[#AD1D1D] p-4 text-left text-sm font-bold text-white shadow-inner custom-scrollbar">
              {errorMessage}
            </p>
          </div>
          <OreButton
            variant="secondary"
            onClick={() => setStatus('idle')}
            size="lg"
            className="ring-2 ring-white"
          >
            返回并重试
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
