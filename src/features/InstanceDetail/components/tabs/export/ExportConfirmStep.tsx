import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Folder,
  Layers,
  List,
  Package,
  RotateCcw,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreProgressBar } from '../../../../../ui/primitives/OreProgressBar';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { ExportData } from './ExportPanel';

interface ExportConfirmStepProps {
  instanceId: string;
  data: ExportData;
  onBack: () => void;
}

interface ExportProgress {
  taskId: string;
  current: number;
  total: number;
  message: string;
  stage: string;
}

interface ExportResult {
  outputPath: string;
  packedFiles: number;
  referencedModFiles: number;
  bundledModFiles: number;
  warnings: string[];
}

const getBasename = (path: string) => path.split(/[/\\]/).pop() || path;

export const ExportConfirmStep: React.FC<ExportConfirmStepProps> = ({
  instanceId,
  data,
  onBack,
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const exportTaskIdRef = useRef<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const formatLabels: Record<ExportData['format'], string> = {
    zip: t('instanceDetail.export.confirm.format.zip', { defaultValue: '标准 ZIP 归档' }),
    curseforge: 'CurseForge 整合包',
    mrpack: 'Modrinth (mrpack) 整合包',
    pipack: 'PiPack 专属智能包',
  };

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
            // Ignore if directory exists
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
    let active = true;
    const unlistenPromise = listen<ExportProgress>('export-progress', (event) => {
      if (!active || event.payload.taskId !== exportTaskIdRef.current) return;
      setProgress(event.payload);
    });

    return () => {
      active = false;
      unlistenPromise.then((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setFocus('export-success-dir-btn');
      }, 100);
      return () => clearTimeout(timer);
    } else if (status === 'error') {
      const timer = setTimeout(() => {
        setFocus('export-error-retry-btn');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const fileExtension =
    data.format === 'pipack' ? 'pipack' : data.format === 'mrpack' ? 'mrpack' : 'zip';
  const effectiveManifestMode =
    data.format === 'pipack' || data.format === 'zip' ? true : data.manifestMode;
  const outputFileName = `${data.name}-${data.version}.${fileExtension}`;
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const contentList: string[] = [
    data.includeMods ? 'Mods (模组)' : '',
    data.includeConfigs ? 'Config (配置)' : '',
    data.includeResourcePacks ? 'Resource Packs (材质)' : '',
    data.includeShaderPacks ? 'Shader Packs (光影)' : '',
    data.includeSaves ? 'Saves (存档)' : '',
    ...data.additionalPaths.map((item) =>
      t('instanceDetail.export.confirm.customItem', {
        defaultValue: '附加{{type}}: {{name}}',
        type: item.type === 'dir' ? '(目录)' : '(文件)',
        name: getBasename(item.path),
      })
    ),
  ].filter(Boolean);

  const getLocalizedStage = (stage?: string): string => {
    switch (stage?.toUpperCase()) {
      case 'INIT':
        return t('instanceDetail.export.progress.stageInit', { defaultValue: '初始化环境' });
      case 'COLLECTING':
        return t('instanceDetail.export.progress.stageCollecting', { defaultValue: '扫描收集文件' });
      case 'PACKING':
        return t('instanceDetail.export.progress.stagePacking', { defaultValue: '正在打包压缩' });
      case 'WRITING_MANIFEST':
        return t('instanceDetail.export.progress.stageManifest', { defaultValue: '生成配置清单' });
      case 'DONE':
        return t('instanceDetail.export.progress.stageDone', { defaultValue: '导出完成' });
      default:
        return stage || t('instanceDetail.export.progress.stageQueue', { defaultValue: '等待队列' });
    }
  };

  const getLocalizedMessage = (msg?: string): string => {
    if (!msg) {
      return t('instanceDetail.export.progress.preparing', { defaultValue: '正在准备导出任务...' });
    }
    if (msg.startsWith('Packing ')) {
      const filename = msg.replace('Packing ', '').replace(/^"|"$/g, '');
      return t('instanceDetail.export.progress.packingFile', {
        defaultValue: '正在写入: {{name}}',
        name: filename,
      });
    }
    if (msg.includes('Initializing export')) {
      return t('instanceDetail.export.progress.init', { defaultValue: '正在准备整合包临时打包环境...' });
    }
    if (msg.includes('Collecting selected files')) {
      return t('instanceDetail.export.progress.collecting', { defaultValue: '正在收集选定模组与配置文件...' });
    }
    if (msg.includes('Writing pack manifest')) {
      return t('instanceDetail.export.progress.writingManifest', { defaultValue: '正在生成整合包索引清单 (manifest)...' });
    }
    if (msg.includes('Export completed successfully')) {
      return t('instanceDetail.export.progress.completed', { defaultValue: '整合包文件打包完成！' });
    }
    return msg;
  };

  const handleStartExport = async () => {
    if (!outputDir) return;

    try {
      const outputPath = await join(outputDir, outputFileName);
      const additionalStrings = data.additionalPaths.map((item) => item.path);
      const taskId = crypto.randomUUID();

      setProgress(null);
      setErrorMessage('');
      setWarnings([]);
      exportTaskIdRef.current = taskId;
      setExportTaskId(taskId);
      setStatus('exporting');

      const result = await invoke<ExportResult>('export_modpack', {
        config: {
          taskId,
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
      setWarnings(result.warnings);
      setStatus('success');
    } catch (error: any) {
      console.error('Export failed:', error);
      setStatus('error');
      setErrorMessage(error.toString());
    } finally {
      exportTaskIdRef.current = null;
    }
  };

  const handleChangeOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: outputDir || undefined,
      });
      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (error) {
      console.error('Failed to select output directory:', error);
    }
  };

  const handleCancelExport = async () => {
    if (!exportTaskId) return;
    try {
      await invoke('cancel_modpack_export', { taskId: exportTaskId });
    } catch (error) {
      console.error('Failed to cancel export:', error);
    }
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto flex flex-col space-y-5 font-minecraft select-none">
      {status === 'idle' && (
        <div className="flex flex-col space-y-4">
          {/* 1. 顶部平铺信息摘要大石板 */}
          <div className="border-[3px] border-[#1E1E1F] bg-[#48494A] p-5 sm:p-6 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] space-y-4">
            {/* 顶栏：标题与格式徽标 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1E1E1F] pb-3.5">
              <div className="flex items-center gap-2">
                <List size={16} className="text-[#6CC349]" />
                <span className="text-sm font-bold uppercase tracking-wider text-white">
                  {t('instanceDetail.export.confirm.summaryTitle', { defaultValue: '导出信息平铺摘要' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <OreTag variant="success" size="sm" weight="bold">
                  {formatLabels[data.format]}
                </OreTag>
                {effectiveManifestMode && (
                  <OreTag variant="neutral" size="sm" weight="bold">
                    Manifest 索引模式
                  </OreTag>
                )}
              </div>
            </div>

            {/* 整合包核心名称展示栏 (平铺无截断，宽幅 HeroLogo 展示) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-[2px] border-[#1E1E1F] bg-[#222324] p-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
                {data.heroLogo ? (
                  <div className="flex w-36 sm:w-44 h-14 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                    <img src={data.heroLogo} alt="Hero Logo" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
                    <Package size={24} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C8D90] mb-0.5">
                    {t('instanceDetail.export.confirm.packName', { defaultValue: '整合包名称' })}
                  </div>
                  <h3 className="break-words text-base sm:text-lg font-bold text-white leading-tight">
                    {data.name || '未命名整合包'}
                  </h3>
                </div>
              </div>

              {/* 版本与作者横向平铺 */}
              <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1E1E1F] w-full sm:w-auto">
                <div className="flex items-center gap-1.5 border border-[#1E1E1F] bg-[#141517] px-3 py-1.5">
                  <Tag size={13} className="text-[#6CC349]" />
                  <span className="text-xs text-[#8C8D90]">版本:</span>
                  <span className="text-xs font-bold text-white font-['JetBrains_Mono',monospace]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {data.version || '1.0.0'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 border border-[#1E1E1F] bg-[#141517] px-3 py-1.5">
                  <User size={13} className="text-[#6CC349]" />
                  <span className="text-xs text-[#8C8D90]">作者:</span>
                  <span className="text-xs font-bold text-[#E6E8EB]">
                    {data.author || 'Player'}
                  </span>
                </div>
              </div>
            </div>

            {/* 包含内容平铺池 */}
            <div className="border-[2px] border-[#1E1E1F] bg-[#313233] p-3.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <Layers size={14} className="text-[#6CC349]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                  {t('instanceDetail.export.confirm.includeContent', { defaultValue: '包含的导出模块与附件' })}
                </span>
                <span className="text-xs text-[#8C8D90]">({contentList.length} 项)</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {contentList.length > 0 ? (
                  contentList.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="border border-[#1E1E1F] bg-[#222324] px-3 py-1 text-xs font-bold text-[#E6E8EB] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                    >
                      {item}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[#FF9E9E]">未勾选任何导出内容</span>
                )}
              </div>

              {data.description && (
                <div className="mt-3 border-t border-[#1E1E1F] pt-2.5 text-xs text-[#8C8D90] leading-relaxed">
                  <span className="text-[#D0D1D4] font-bold mr-1">描述说明:</span>
                  {data.description}
                </div>
              )}
            </div>
          </div>

          {/* 2. 导出路径与打包操作条 */}
          <div className="border-[3px] border-[#1E1E1F] bg-[#313233] p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* 路径详情展示 */}
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#1E1E1F] pb-2">
                  <div className="flex items-center text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                    <Folder size={15} className="mr-1.5 text-[#6CC349]" />
                    <span>{t('instanceDetail.export.confirm.exportPath', { defaultValue: '导出目标路径' })}</span>
                  </div>
                  <OreButton size="sm" variant="secondary" onClick={handleChangeOutputDir}>
                    <span>{t('instanceDetail.export.confirm.changePath', { defaultValue: '更改目标目录' })}</span>
                  </OreButton>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="border-[2px] border-[#1E1E1F] bg-[#141517] p-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                    <div className="text-[10px] text-[#8C8D90] uppercase mb-0.5">目标目录</div>
                    <div
                      className="break-all text-xs text-[#D0D1D4] font-['JetBrains_Mono',monospace]"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      title={outputDir}
                    >
                      {outputDir || '正在获取默认路径...'}
                    </div>
                  </div>

                  <div className="border-[2px] border-[#1E1E1F] bg-[#141517] p-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                    <div className="text-[10px] text-[#8C8D90] uppercase mb-0.5">生成文件名</div>
                    <div
                      className="break-all text-xs text-[#6CC349] font-bold font-['JetBrains_Mono',monospace]"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {outputFileName}
                    </div>
                  </div>
                </div>
              </div>

              {/* 立即执行打包按钮 */}
              <div className="flex shrink-0 items-center justify-end md:pl-4">
                <OreButton
                  disabled={!outputDir || contentList.length === 0}
                  variant="primary"
                  size="md"
                  onClick={handleStartExport}
                  className="w-full md:w-auto min-w-[14rem] h-[3.25rem]"
                >
                  <Download size={20} className="mr-2" />
                  <span className="text-base font-bold">{t('instanceDetail.export.confirm.startExport', { defaultValue: '立即执行打包' })}</span>
                </OreButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 大气 3D 基岩打包中终端界面 (Atmospheric 3D Forge Packaging View) */}
      {status === 'exporting' && (
        <div className="flex flex-col items-center justify-center border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 sm:p-12 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] space-y-7">
          {/* 大气 3D 浮雕打包方块核心 */}
          <div className="relative flex h-28 w-28 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#222324] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_28px_rgba(60,133,39,0.3)]">
            {/* 内部呼吸锻造光晕 */}
            <div className="absolute inset-1.5 border border-[#3C8527]/50 bg-[#244A1B]/30 animate-pulse" />

            {/* 3D 悬浮微动方块 */}
            <motion.div
              animate={{ y: [-3, 3, -3], rotate: [-1.5, 1.5, -1.5] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              className="relative z-10 flex items-center justify-center"
            >
              <Package size={52} className="text-[#6CC349] drop-shadow-[0_4px_12px_rgba(108,195,73,0.6)]" />
            </motion.div>

            {/* 右上角火花标识 */}
            <Sparkles size={16} className="absolute -top-2 -right-2 text-[#FFE866] animate-bounce z-20" />
          </div>

          {/* 状态与阶段标题 */}
          <div className="space-y-2 text-center max-w-lg">
            <div className="flex items-center justify-center gap-2">
              <OreTag variant="success" size="sm" weight="bold">
                {getLocalizedStage(progress?.stage)}
              </OreTag>
              <span className="text-xs font-bold text-[#8C8D90]">阶段进行中</span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-white ore-text-shadow">
              {t('instanceDetail.export.confirm.exporting', { defaultValue: '正在打包导出整合包...' })}
            </h4>
          </div>

          {/* 下沉式当前文件/子任务实时状态终端槽 */}
          <div
            className="w-full max-w-lg border-[2px] border-[#1E1E1F] bg-[#141517] px-4 py-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] text-center text-xs text-[#D0D1D4] font-['JetBrains_Mono',monospace] truncate"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
            title={getLocalizedMessage(progress?.message)}
          >
            {getLocalizedMessage(progress?.message)}
          </div>

          {/* 进度条与百分比 */}
          <div className="w-full max-w-lg space-y-2.5">
            <OreProgressBar percent={percent} showPercentage={false} size="md" className="w-full" />
            <div
              className="flex justify-between items-center text-xs sm:text-sm text-[#D0D1D4] font-['JetBrains_Mono',monospace]"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              <span className="text-[#8C8D90]">
                {t('instanceDetail.export.confirm.currentStageLabel', { defaultValue: '当前进度' })}
              </span>
              <span className="font-bold text-[#6CC349] text-base">{percent}%</span>
            </div>
          </div>

          {/* 取消动作按钮 */}
          <OreButton variant="danger" size="md" onClick={handleCancelExport} className="min-w-[8rem]">
            <X size={16} className="mr-1.5" />
            <span>{t('common.cancel', { defaultValue: '取消打包' })}</span>
          </OreButton>
        </div>
      )}

      {/* 4. 导出成功状态 (Success) */}
      {status === 'success' && (
        <div className="flex flex-col items-center justify-center border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 sm:p-12 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] space-y-7">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#3C8527] shadow-[inset_0_2px_0_#6CC349,inset_0_-2px_0_#1D4D13]">
            <CheckCircle2 size={44} className="text-white" />
          </div>

          <div className="space-y-2 max-w-lg">
            <h4 className="text-2xl font-bold uppercase tracking-wider text-white ore-text-shadow">
              {t('instanceDetail.export.confirm.exportSuccess', { defaultValue: '整合包导出完成' })}
            </h4>
            <div
              className="border-[2px] border-[#1E1E1F] bg-[#141517] p-3 text-xs sm:text-sm text-[#6CC349] font-['JetBrains_Mono',monospace] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] break-all"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {outputDir}
            </div>
            {warnings.length > 0 && (
              <p className="mx-auto mt-2 text-xs text-[#FFE866]">
                {warnings[0]}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <OreButton
              focusKey="export-success-dir-btn"
              variant="secondary"
              size="md"
              onClick={() => invoke('show_in_folder', { path: outputDir })}
            >
              <ExternalLink size={18} className="mr-2" />
              <span>{t('instanceDetail.export.confirm.openDir', { defaultValue: '打开输出目录' })}</span>
            </OreButton>
            <OreButton
              focusKey="export-success-back-btn"
              variant="primary"
              size="md"
              onClick={onBack}
            >
              <RotateCcw size={18} className="mr-2" />
              <span>{t('instanceDetail.export.confirm.backToSettings', { defaultValue: '返回导出设置' })}</span>
            </OreButton>
          </div>
        </div>
      )}

      {/* 5. 导出异常状态 (Error) */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center border-[3px] border-[#1E1E1F] bg-[#48494A] p-8 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] space-y-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center border-[3px] border-[#1E1E1F] bg-[#C33636] text-white">
            <AlertTriangle size={36} />
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xl font-bold uppercase tracking-wider text-white ore-text-shadow">
              {t('instanceDetail.export.confirm.exportError', { defaultValue: '打包任务异常终止' })}
            </h4>
          </div>

          <div
            className="max-h-40 max-w-xl overflow-y-auto border-[2px] border-[#1E1E1F] bg-[#141517] p-4 text-left text-xs text-[#FF9E9E] font-['JetBrains_Mono',monospace] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {errorMessage}
          </div>

          <OreButton
            focusKey="export-error-retry-btn"
            variant="secondary"
            size="md"
            onClick={() => setStatus('idle')}
          >
            <RotateCcw size={18} className="mr-2" />
            <span>{t('instanceDetail.export.confirm.backAndRetry', { defaultValue: '返回并重试' })}</span>
          </OreButton>
        </div>
      )}
    </div>
  );
};

export default ExportConfirmStep;