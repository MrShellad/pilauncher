import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { ExportConfirmationSummary } from './ExportConfirmationSummary';
import { ExportExecutionStatus } from './ExportExecutionStatus';
import type { ExportData } from './ExportPanel';
import {
  getExportPathBasename,
  type ExportProgress,
  type ExportResult,
  type ExportStatus,
} from './exportConfirmationTypes';

interface ExportConfirmStepProps {
  instanceId: string;
  data: ExportData;
  onBack: () => void;
}

export const ExportConfirmStep: React.FC<ExportConfirmStepProps> = ({
  instanceId,
  data,
  onBack,
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const exportTaskIdRef = useRef<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const formatLabels: Record<ExportData['format'], string> = {
    zip: t('instanceDetail.export.confirm.format.zip', {
      defaultValue: '标准 ZIP 归档',
    }),
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
    }

    if (status === 'error') {
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
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

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
        name: getExportPathBasename(item.path),
      })
    ),
  ].filter(Boolean);

  const getLocalizedStage = (stage?: string): string => {
    switch (stage?.toUpperCase()) {
      case 'INIT':
        return t('instanceDetail.export.progress.stageInit', {
          defaultValue: '初始化环境',
        });
      case 'COLLECTING':
        return t('instanceDetail.export.progress.stageCollecting', {
          defaultValue: '扫描收集文件',
        });
      case 'PACKING':
        return t('instanceDetail.export.progress.stagePacking', {
          defaultValue: '正在打包压缩',
        });
      case 'WRITING_MANIFEST':
        return t('instanceDetail.export.progress.stageManifest', {
          defaultValue: '生成配置清单',
        });
      case 'DONE':
        return t('instanceDetail.export.progress.stageDone', {
          defaultValue: '导出完成',
        });
      default:
        return (
          stage ||
          t('instanceDetail.export.progress.stageQueue', {
            defaultValue: '等待队列',
          })
        );
    }
  };

  const getLocalizedMessage = (message?: string): string => {
    if (!message) {
      return t('instanceDetail.export.progress.preparing', {
        defaultValue: '正在准备导出任务...',
      });
    }
    if (message.startsWith('Packing ')) {
      const filename = message.replace('Packing ', '').replace(/^"|"$/g, '');
      return t('instanceDetail.export.progress.packingFile', {
        defaultValue: '正在写入: {{name}}',
        name: filename,
      });
    }
    if (message.includes('Initializing export')) {
      return t('instanceDetail.export.progress.init', {
        defaultValue: '正在准备整合包临时打包环境...',
      });
    }
    if (message.includes('Collecting selected files')) {
      return t('instanceDetail.export.progress.collecting', {
        defaultValue: '正在收集选定模组与配置文件...',
      });
    }
    if (message.includes('Writing pack manifest')) {
      return t('instanceDetail.export.progress.writingManifest', {
        defaultValue: '正在生成整合包索引清单 (manifest)...',
      });
    }
    if (message.includes('Export completed successfully')) {
      return t('instanceDetail.export.progress.completed', {
        defaultValue: '整合包文件打包完成！',
      });
    }
    return message;
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
    } catch (error: unknown) {
      console.error('Export failed:', error);
      setStatus('error');
      setErrorMessage(String(error));
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
    <div className="mx-auto flex w-full max-w-4xl select-none flex-col space-y-5 font-minecraft xl:max-w-5xl">
      {status === 'idle' && (
        <ExportConfirmationSummary
          data={data}
          formatLabel={formatLabels[data.format]}
          effectiveManifestMode={effectiveManifestMode}
          contentList={contentList}
          outputDir={outputDir}
          outputFileName={outputFileName}
          onChangeOutputDir={handleChangeOutputDir}
          onStartExport={handleStartExport}
        />
      )}

      <ExportExecutionStatus
        status={status}
        percent={percent}
        stageLabel={getLocalizedStage(progress?.stage)}
        progressMessage={getLocalizedMessage(progress?.message)}
        outputDir={outputDir}
        warnings={warnings}
        errorMessage={errorMessage}
        onCancel={handleCancelExport}
        onOpenOutputDirectory={() => void invoke('show_in_folder', { path: outputDir })}
        onBack={onBack}
        onRetry={() => setStatus('idle')}
      />
    </div>
  );
};

export default ExportConfirmStep;
