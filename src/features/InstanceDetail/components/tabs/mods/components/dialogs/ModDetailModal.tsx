// /src/features/InstanceDetail/components/tabs/mods/components/dialogs/ModDetailModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Virtuoso } from 'react-virtuoso';
import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { OreSegmentedControl } from '../../../../../../../ui/primitives/OreSegmentedControl';
import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Loader2, Trash2, Power, Download, AlertTriangle } from 'lucide-react';
import {
  fetchModrinthVersions,
  fetchModrinthInfo,
  fetchModrinthProjectById,
  searchModrinth,
  type ModrinthProject,
  type OreProjectDetail,
  type OreProjectVersion
} from '../../../../../logic/modrinthApi';
import { fetchCurseForgeVersions, getCurseForgeProjectDetails, searchCurseForge } from '../../../../../../Download/logic/curseforgeApi';
import {
  getModPlatformReference,
  modService,
  resolveInstanceGameVersion,
  resolveInstanceLoader,
  type ModMeta,
  type ModVersionInstallAction
} from '../../../../../logic/modService';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
  onClose: () => void;
  onToggle: (fileName: string, currentEnabled: boolean) => void;
  onDelete: (fileName: string) => void;
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion, action: ModVersionInstallAction) => void;
}

const toNetworkInfo = (detail: OreProjectDetail, source: 'modrinth' | 'curseforge'): ModrinthProject => ({
  id: detail.id,
  project_id: detail.id,
  slug: detail.id,
  title: detail.title,
  description: detail.description,
  icon_url: detail.icon_url || '',
  author: detail.author,
  downloads: detail.downloads,
  date_modified: detail.updated_at,
  client_side: detail.client_side,
  server_side: detail.server_side,
  follows: detail.followers,
  loaders: detail.loaders,
  categories: detail.loaders,
  display_categories: detail.loaders,
  gallery_urls: detail.gallery_urls,
  source
});

export const ModDetailModal: React.FC<ModDetailModalProps> = ({
  mod,
  instanceConfig,
  onClose,
  onToggle,
  onDelete,
  onInstallVersion
}) => {
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [displayMod, setDisplayMod] = useState<ModMeta | null>(null);
  const [activePlatform, setActivePlatform] = useState<'modrinth' | 'curseforge'>('modrinth');
  const lastFocusBeforeModalRef = useRef<string | null>(null);

  // 删除确认弹窗状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastFocusBeforeDeleteRef = useRef<string | null>(null);

  useEffect(() => {
    if (mod) {
      setDisplayMod(mod);
      const sourcePlatform = mod.manifestEntry?.source.platform;
      setActivePlatform(sourcePlatform === 'curseforge' ? 'curseforge' : 'modrinth');

      const projectId = sourcePlatform === 'modrinth' || sourcePlatform === 'curseforge'
        ? mod.manifestEntry?.source.projectId
        : undefined;
      const query =
        mod.modId ||
        mod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');
      const metadataRequest = projectId
        ? sourcePlatform === 'curseforge'
          ? getCurseForgeProjectDetails(projectId).then((detail) => toNetworkInfo(detail, 'curseforge'))
          : fetchModrinthProjectById(projectId)
        : fetchModrinthInfo(query);

      metadataRequest.then(netInfo => {
        if (netInfo) {
          setDisplayMod(prev => prev ? { ...prev, networkInfo: netInfo } : null);
          if (mod.cacheKey) {
            modService.updateModCache(
              mod.cacheKey,
              netInfo.title, netInfo.description, netInfo.icon_url
            ).catch(console.error);
          }
        }
      }).catch(console.error);
    }
  }, [mod]);

  useEffect(() => {
    if (mod) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusBeforeModalRef.current = currentFocus;
      }
      setTimeout(() => {
        if (doesFocusableExist('btn-mod-toggle')) {
          setFocus('btn-mod-toggle');
        }
      }, 150);
    } else {
      setShowDeleteConfirm(false);
    }
  }, [mod]);

  useEffect(() => {
    if (showDeleteConfirm) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusBeforeDeleteRef.current = currentFocus;
      }
      setTimeout(() => setFocus('btn-delete-cancel'), 100);
    }
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (displayMod && instanceConfig) {
      setIsLoadingVersions(true);

      let projectId: string | undefined = undefined;
      if (activePlatform === 'curseforge') {
        projectId = (displayMod.networkInfo?.source === 'curseforge' ? displayMod.networkInfo.id : undefined)
          || getModPlatformReference(displayMod, 'curseforge')?.projectId;
      } else {
        projectId = (displayMod.networkInfo?.source === 'modrinth' ? displayMod.networkInfo.id : undefined)
          || getModPlatformReference(displayMod, 'modrinth')?.projectId
          || displayMod.modId;
      }

      const fetchPlatformVersions = async () => {
        let currentProjectId = projectId;

        if (!currentProjectId) {
          const query = displayMod.modId || displayMod.name || displayMod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');

          if (activePlatform === 'curseforge') {
            const res = await searchCurseForge({ query, limit: 1 });
            if (res.hits.length > 0) currentProjectId = res.hits[0].id;
          } else {
            const res = await searchModrinth({ query, limit: 1 });
            if (res.hits.length > 0) currentProjectId = res.hits[0].id;
          }
        }

        if (!currentProjectId) {
          setModVersions([]);
          setIsLoadingVersions(false);
          return;
        }

        const targetMc = resolveInstanceGameVersion(instanceConfig);
        const targetLoader = resolveInstanceLoader(instanceConfig);
        const fetchVersions = activePlatform === 'curseforge'
          ? fetchCurseForgeVersions
          : fetchModrinthVersions;

        const res = await fetchVersions(currentProjectId, targetMc, targetLoader);
        setModVersions(res);
      };

      fetchPlatformVersions()
        .catch(err => console.error("获取版本失败:", err))
        .finally(() => setIsLoadingVersions(false));
    } else {
      setModVersions([]);
    }
  }, [displayMod, instanceConfig, activePlatform]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      }
    }, 50);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setTimeout(() => {
      const lastFocus = lastFocusBeforeDeleteRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      } else {
        setFocus('btn-mod-delete');
      }
    }, 50);
  };

  const handleExecuteDelete = () => {
    if (!mod) return;
    onDelete(mod.fileName);
    setShowDeleteConfirm(false);
    handleClose();
  };

  if (!mod) return null;

  const sourceLabel = displayMod?.networkInfo?.source === 'curseforge'
    ? 'CurseForge'
    : displayMod?.networkInfo?.source === 'modrinth' || displayMod?.manifestEntry?.source.platform === 'modrinth'
      ? 'Modrinth'
      : displayMod?.manifestEntry?.source.platform || '本地';

  const cacheKey = displayMod?.modifiedAt || displayMod?.fileSize || displayMod?.fileName || 'cache';
  const currentFileId = displayMod?.manifestEntry?.source.fileId || mod.manifestEntry?.source.fileId;
  const currentVersionIndex = currentFileId
    ? modVersions.findIndex((version) => version.id === currentFileId)
    : -1;
  const getVersionInstallAction = (version: OreProjectVersion, index: number): ModVersionInstallAction => {
    if (version.id === currentFileId) return 'reinstall';
    if (currentVersionIndex < 0) return 'install';
    return index < currentVersionIndex ? 'upgrade' : 'downgrade';
  };
  const versionInstallLabels: Record<ModVersionInstallAction, string> = {
    install: '安装',
    upgrade: '升级',
    downgrade: '降级',
    reinstall: '重装'
  };

  const modalActions = (
    <>
      <OreButton focusKey="btn-mod-toggle" variant={displayMod?.isEnabled ? 'secondary' : 'primary'} size="sm" onClick={() => onToggle(mod.fileName, !!displayMod?.isEnabled)}>
        <Power size={14} className="mr-1.5" /> {displayMod?.isEnabled ? "禁用" : "启用"}
      </OreButton>
      <OreButton focusKey="btn-mod-delete" variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
        <Trash2 size={14} className="mr-1.5" /> 删除
      </OreButton>
      <OreButton focusKey="btn-mod-cancel" variant="secondary" size="sm" onClick={handleClose}>
        取消
      </OreButton>
    </>
  );

  return (
    <>
      <OreModal
        isOpen={!!mod && !showDeleteConfirm}
        onClose={handleClose}
        title={displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}
        className="w-[95vw] max-w-4xl h-[85vh] sm:h-[75vh]"
        contentClassName="flex flex-col min-h-0 p-0"
        actions={modalActions}
      >
        <FocusBoundary id="mod-detail-boundary" trapFocus onEscape={handleClose} className="flex flex-col min-h-0 h-full bg-[#141415] p-4 sm:p-6 gap-4 sm:gap-5">
          {/* Header Info Block */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto sm:mx-0 flex-shrink-0 bg-[#1A1A1C] border border-[#2A2A2C] flex items-center justify-center p-1 rounded-sm relative shadow-sm">
              {mod.isFetchingNetwork && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-ore-green" /></div>}

              {displayMod?.iconAbsolutePath || displayMod?.networkIconUrl || displayMod?.networkInfo?.icon_url ? (
                <img src={displayMod.iconAbsolutePath ? `${convertFileSrc(displayMod.iconAbsolutePath)}?t=${cacheKey}` : (displayMod.networkIconUrl || displayMod.networkInfo?.icon_url)} alt="icon" className="w-full h-full object-cover rounded-sm" />
              ) : <Blocks size={36} className="text-gray-600" />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-minecraft text-white drop-shadow-sm flex flex-col sm:flex-row items-center sm:justify-start gap-2 sm:gap-3 truncate mb-1.5">
                <span className="truncate">{displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}</span>
                {!displayMod?.isEnabled && <span className="flex-shrink-0 text-xs font-sans bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 tracking-wider">已禁用</span>}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 sm:gap-x-5 gap-y-1.5 text-xs sm:text-sm text-gray-400 font-sans">
                <span className="truncate max-w-[12rem] sm:max-w-xs">文件: {displayMod?.fileName}</span>
                <span>大小: {displayMod?.fileSize ? (displayMod.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}</span>
                <span>来源: {sourceLabel}</span>
                <span>状态: {mod.isFetchingNetwork ? '匹配中...' : (displayMod?.networkInfo ? `已链接至 ${sourceLabel}` : '未找到匹配项目')}</span>
              </div>
            </div>
          </div>


          {/* Version History */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/5 pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-3 gap-3 shrink-0">
              <h3 className="font-minecraft text-white text-sm sm:text-base tracking-wide">版本历史 (当前实例)</h3>
              <OreSegmentedControl
                tabs={[
                  { id: 'modrinth', label: 'Modrinth' },
                  { id: 'curseforge', label: 'CurseForge' }
                ]}
                activeTab={activePlatform}
                onChange={(id) => setActivePlatform(id as 'modrinth' | 'curseforge')}
                className="scale-90 sm:scale-100 origin-center sm:origin-right"
              />
            </div>
            {isLoadingVersions ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-ore-green" /></div>
            ) : modVersions.length > 0 ? (
              <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <Virtuoso
                  className="h-full custom-scrollbar"
                  data={modVersions}
                  itemContent={(index, v) => {
                    const action = getVersionInstallAction(v, index);
                    const actionLabel = versionInstallLabels[action];
                    const actionTarget = displayMod || mod;

                    return (
                      <FocusItem key={v.id || index} focusKey={`mod-version-${index}`}>
                        {({ ref, focused }) => (
                          <div
                            ref={ref as any}
                            className={`flex flex-col sm:flex-row justify-between sm:items-center py-2.5 px-3 sm:px-4 bg-transparent border-b border-[#2A2A2C]/50 outline-none transition-all cursor-pointer gap-3 sm:gap-0 ${focused ? 'bg-[#2A2A2C] z-10 brightness-110' : 'hover:bg-[#202022]'}`}
                          >
                            <div className="flex items-center flex-1 min-w-0 pr-0 sm:pr-4">
                              <div className={`hidden sm:block w-2 h-2 rounded-full mr-3 flex-shrink-0 ${focused ? 'bg-white' : 'bg-ore-green/80'}`}></div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className={`font-minecraft text-sm truncate ${focused ? 'text-white' : 'text-gray-200'}`}>
                                  <span className={`inline-block sm:hidden w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${focused ? 'bg-white' : 'bg-ore-green/80'}`}></span>
                                  {v.name}
                                </span>
                                <span className="text-xs text-ore-text-muted mt-0.5 truncate font-sans">
                                  版本: {v.version_number} • {new Date(v.date_published).toLocaleDateString()} 发布
                                </span>
                              </div>
                            </div>
                            <OreButton
                              focusKey={`btn-install-${index}`}
                              variant={action === 'reinstall' ? "secondary" : "primary"}
                              size="sm"
                              onClick={() => onInstallVersion(actionTarget, v, action)}
                              className="w-full sm:w-20 shrink-0"
                            >
                              <Download size={13} className="mr-1.5" />
                              {actionLabel}
                            </OreButton>
                          </div>
                        )}
                      </FocusItem>
                    );
                  }}
                />
              </div>
            ) : (
              <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm border border-dashed border-[#2A2A2C] bg-[#1A1A1C] rounded-sm flex items-center justify-center">
                暂无在 {activePlatform} 上的版本记录
              </div>
            )}
          </div>
        </FocusBoundary>
      </OreModal>

      <OreModal
        isOpen={showDeleteConfirm}
        onClose={handleCloseDeleteConfirm}
        title="删除模组"
        className="w-[95vw] max-w-md"
      >
        <FocusBoundary id="mod-delete-confirm-boundary" trapFocus onEscape={handleCloseDeleteConfirm} className="flex flex-col bg-[#141415]">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-8 text-center sm:text-left">
            <div className="p-3 bg-red-500/10 rounded-sm border border-red-500/20 shrink-0">
              <AlertTriangle className="text-red-500" size={28} />
            </div>
            <div className="flex-1 mt-1">
              <h3 className="text-white font-minecraft text-base mb-2 relative">
                确定要删除
                <span className="font-bold underline decoration-red-500/50 underline-offset-4 mx-1.5 inline-block text-base align-baseline leading-none break-all">{displayMod?.fileName}</span>
                吗？
              </h3>
              <p className="text-gray-400 text-sm">此操作将会把该模组从实例的 mods 文件夹中移除，删除后无法通过启动器撤销恢复该文件。</p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-auto">
            <OreButton focusKey="btn-delete-cancel" variant="secondary" onClick={handleCloseDeleteConfirm} className="w-full sm:w-24">
              取消
            </OreButton>
            <OreButton focusKey="btn-delete-confirm" variant="danger" onClick={handleExecuteDelete} className="w-full sm:w-36 font-bold">
              确认删除
            </OreButton>
          </div>
        </FocusBoundary>
      </OreModal>
    </>
  );
};
