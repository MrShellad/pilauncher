import React, { useMemo } from 'react';
import { Database, FolderOpen, Loader2 } from 'lucide-react';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type {
  ThirdPartyImportInstance,
  ThirdPartyImportSource,
} from '../../../../hooks/pages/Instances/useThirdPartyImport';

const formatSourceKind = (value: string) => {
  switch (value) {
    case 'minecraft_root':
      return '完整 .minecraft';
    case 'versions_dir':
      return 'versions 目录';
    case 'instance_dir':
      return '单个实例目录';
    default:
      return value;
  }
};

export const formatInstanceStatus = (instance: ThirdPartyImportInstance) => {
  switch (instance.status) {
    case 'importable':
      return { label: '可导入', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' };
    case 'already_imported':
      return { label: '已导入', className: 'border-sky-500/30 bg-sky-500/10 text-sky-200' };
    case 'name_conflict':
      return { label: '名称冲突', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' };
    case 'imported':
      return { label: '导入成功', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' };
    default:
      return { label: instance.status, className: 'border-white/10 bg-white/5 text-white/70' };
  }
};

export interface ThirdPartyImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  importSources: ThirdPartyImportSource[];
  isDetectingSources: boolean;
  isImporting: boolean;
  handleImportSource: (source: ThirdPartyImportSource) => void;
}

export const ThirdPartyImportPanel: React.FC<ThirdPartyImportPanelProps> = ({
  isOpen,
  onClose,
  importSources,
  isDetectingSources,
  isImporting,
  handleImportSource,
}) => {
  const focusOrder = useMemo(() => {
    return [...importSources.map((_, index) => `import-source-${index}`), 'panel-close'];
  }, [importSources]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder, focusOrder[0], true, isOpen);

  if (!isOpen) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={isImporting ? () => { } : onClose}
      title="第三方启动器库导入"
      className="!w-[800px]"
      actions={
        <div className="flex w-full justify-center">
          <OreButton
            variant="secondary"
            size="sm"
            focusKey="panel-close"
            onClick={onClose}
            disabled={isImporting}
            onArrowPress={handleLinearArrow}
          >
            关闭
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-[2px] border border-white/10 bg-[#0F0F10] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-minecraft text-lg tracking-wider text-white">第三方启动器库导入</p>
            <p className="text-sm leading-relaxed text-ore-text-muted">
              自动探测 `%APPDATA%/.minecraft`、启动器同级 `.minecraft` 等常见路径，也支持手动选择
              `.minecraft`、`versions` 或单个实例目录。
            </p>
          </div>
        </div>

        {isDetectingSources ? (
          <div className="flex items-center gap-3 rounded-[2px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-ore-text-muted">
            <Loader2 size={18} className="animate-spin text-ore-green" />
            <span>正在扫描常见启动器库路径...</span>
          </div>
        ) : importSources.length === 0 ? (
          <div className="rounded-[2px] border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm leading-relaxed text-ore-text-muted">
            暂未探测到可导入的第三方实例库。你可以点击上方“选择启动器库”手动指定目录。
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {importSources.map((source, index) => (
              <div
                key={source.sourcePath}
                className="flex min-h-[15rem] flex-col gap-3 rounded-[2px] border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <FolderOpen size={15} className="text-ore-green" />
                      <span className="font-minecraft text-base text-white">{source.sourceLabel}</span>
                    </div>
                    <p className="truncate text-xs text-ore-text-muted" title={source.rootPath}>
                      {source.rootPath}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80">
                        {formatSourceKind(source.sourceKind)}
                      </span>
                      {source.hasAssets && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                          Assets
                        </span>
                      )}
                      {source.hasLibraries && (
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
                          Libraries
                        </span>
                      )}
                    </div>
                    <OreButton
                      variant="primary"
                      size="sm"
                      focusKey={`import-source-${index}`}
                      onClick={() => void handleImportSource(source)}
                      disabled={isImporting || source.instanceCount === 0}
                      onArrowPress={handleLinearArrow}
                    >
                      导入这个库
                    </OreButton>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[2px] border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ore-text-muted">实例</p>
                    <p className="font-minecraft text-lg text-white">{source.instanceCount}</p>
                  </div>
                  <div className="rounded-[2px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">可导入</p>
                    <p className="font-minecraft text-lg text-emerald-100">{source.importableCount}</p>
                  </div>
                  <div className="rounded-[2px] border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">已存在</p>
                    <p className="font-minecraft text-lg text-amber-100">
                      {source.alreadyImportedCount + source.conflictCount}
                    </p>
                  </div>
                </div>

                <div className="flex-1 rounded-[2px] border border-white/10 bg-[#0F0F10] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.18em] text-ore-text-muted">
                      识别到的实例
                    </span>
                    <span className="text-xs text-ore-text-muted">{source.instances.length} 项</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {source.instances.slice(0, 4).map((instance) => {
                      const statusMeta = formatInstanceStatus(instance);
                      return (
                        <div
                          key={`${source.sourcePath}-${instance.id}`}
                          className="flex items-center justify-between gap-3 rounded-[2px] border border-white/5 bg-white/[0.03] px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">{instance.name}</p>
                            <p className="truncate text-xs text-ore-text-muted">
                              {instance.mcVersion}
                              {instance.loaderType !== 'vanilla'
                                ? ` · ${instance.loaderType} ${instance.loaderVersion || ''}`
                                : ' · vanilla'}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[11px] ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      );
                    })}

                    {source.instances.length > 4 && (
                      <p className="col-span-2 pt-1 text-xs text-ore-text-muted">
                        还有 {source.instances.length - 4} 个实例，导入日志中会显示完整结果。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OreModal>
  );
};
