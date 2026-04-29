// /src/features/InstanceDetail/components/tabs/mods/ModDetailModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Loader2, Trash2, Power, Download, AlertTriangle } from 'lucide-react';
import {
  fetchModrinthVersions,
  fetchModrinthInfo,
  fetchModrinthProjectById,
  type ModrinthProject,
  type OreProjectDetail,
  type OreProjectVersion
} from '../../../logic/modrinthApi';
import { fetchCurseForgeVersions, getCurseForgeProjectDetails } from '../../../../Download/logic/curseforgeApi';
import {
  modService,
  resolveInstanceGameVersion,
  resolveInstanceLoader,
  type ModMeta
} from '../../../logic/modService';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
  onClose: () => void;
  onToggle: (fileName: string, currentEnabled: boolean) => void;
  onDelete: (fileName: string) => void;
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion) => void;
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
  const lastFocusBeforeModalRef = useRef<string | null>(null);

  // 删除确认弹窗状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastFocusBeforeDeleteRef = useRef<string | null>(null);

  useEffect(() => {
    if (mod) {
      setDisplayMod(mod);
      // ✅ 强制联网更新一次 mod 信息
      const sourcePlatform = mod.manifestEntry?.source.platform;
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
    if (displayMod?.networkInfo && instanceConfig) {
      setIsLoadingVersions(true);
      const targetMc = resolveInstanceGameVersion(instanceConfig);
      const targetLoader = resolveInstanceLoader(instanceConfig);
      const fetchVersions = displayMod.networkInfo.source === 'curseforge'
        ? fetchCurseForgeVersions
        : fetchModrinthVersions;

      fetchVersions(displayMod.networkInfo.id, targetMc, targetLoader)
        .then(res => setModVersions(res.slice(0, 5))) 
        .catch(err => console.error("获取版本失败:", err))
        .finally(() => setIsLoadingVersions(false));
    } else {
      setModVersions([]);
    }
  }, [displayMod?.networkInfo, instanceConfig]);

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

  const displayDesc = displayMod?.description || displayMod?.networkInfo?.description || "没有提供该模组的描述。";
  const sourceLabel = displayMod?.networkInfo?.source === 'curseforge'
    ? 'CurseForge'
    : displayMod?.networkInfo?.source === 'modrinth' || displayMod?.manifestEntry?.source.platform === 'modrinth'
      ? 'Modrinth'
      : displayMod?.manifestEntry?.source.platform || '本地';
  
  // ✅ 修复缓存穿透：生成稳定的 CacheKey
  const cacheKey = displayMod?.modifiedAt || displayMod?.fileSize || displayMod?.fileName || 'cache';

  return (
    <>
      <OreModal isOpen={!!mod && !showDeleteConfirm} onClose={handleClose} title={displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName} className="w-[50rem] h-[70vh]">
        <FocusBoundary id="mod-detail-boundary" trapFocus onEscape={handleClose} className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#141415]">
          <div className="flex gap-6 border-b-2 border-white/5 pb-6">
            <div className="w-24 h-24 flex-shrink-0 bg-[#1E1E1F] border-2 border-[#2A2A2C] shadow-inner flex items-center justify-center p-2 rounded-sm relative">
              {mod.isFetchingNetwork && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-ore-green" /></div>}
              
              {displayMod?.iconAbsolutePath || displayMod?.networkIconUrl || displayMod?.networkInfo?.icon_url ? (
                // ✅ 移除 Date.now()，使用稳定的 t 参数
                <img src={displayMod.iconAbsolutePath ? `${convertFileSrc(displayMod.iconAbsolutePath)}?t=${cacheKey}` : (displayMod.networkIconUrl || displayMod.networkInfo?.icon_url)} alt="icon" className="w-full h-full object-cover" />
              ) : <Blocks size={40} className="text-gray-600" />}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="text-xl font-minecraft text-white drop-shadow-sm flex items-center truncate">
                <span className="truncate">{displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}</span>
                {!displayMod?.isEnabled && <span className="ml-3 flex-shrink-0 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">已禁用</span>}
              </h2>
              <div className="mt-1.5 text-[0.8125rem] text-gray-400 space-y-0.5">
                <p className="truncate">文件名称: {displayMod?.fileName}</p>
                <p>文件大小: {displayMod?.fileSize ? (displayMod.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}</p>
                <p>来源: {sourceLabel}</p>
                <p>识别状态: {mod.isFetchingNetwork ? '正在匹配...' : (displayMod?.networkInfo ? `已链接至 ${sourceLabel}` : '未找到匹配项目')}</p>
              </div>
            </div>
            
            <div className="flex flex-col justify-center gap-2 flex-shrink-0 pl-2">
              <OreButton focusKey="btn-mod-toggle" variant={displayMod?.isEnabled ? 'secondary' : 'primary'} size="sm" onClick={() => onToggle(mod.fileName, !!displayMod?.isEnabled)} className="w-[7.75rem]">
                <Power size={14} className="mr-1.5" /> {displayMod?.isEnabled ? "禁用" : "启用"}
              </OreButton>
              <OreButton focusKey="btn-mod-delete" variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} className="w-[7.75rem]">
                <Trash2 size={14} className="mr-1.5" /> 删除
              </OreButton>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-minecraft text-white text-base mb-2">描述</h3>
            <p className="text-[0.8125rem] text-gray-300 leading-relaxed bg-[#1E1E1F] p-4 rounded-sm border-2 border-[#2A2A2C] shadow-inner">{displayDesc}</p>
          </div>

          <div className="mt-6">
            <h3 className="font-minecraft text-white text-base mb-2">版本历史 (当前实例)</h3>
            {isLoadingVersions ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-ore-green" /></div>
            ) : modVersions.length > 0 ? (
              <div className="bg-[#1E1E1F] border-2 border-[#2A2A2C] rounded-sm shadow-inner overflow-hidden">
                {modVersions.map((v, i) => (
                  <FocusItem key={i} focusKey={`mod-version-${i}`}>
                    {({ ref, focused }) => (
                      <div 
                        ref={ref as any}
                        className={`flex justify-between items-center py-3 px-6 bg-[#18181B] border-b-[0.0625rem] outline-none transition-all cursor-pointer ${focused ? 'border-white bg-[#2A2A2C] scale-[1.002] z-10 brightness-110' : 'border-[#2A2A2C]/50 hover:bg-[#1C1C1E]'}`}
                      >
                        <div className="flex items-center flex-1 min-w-0 pr-4">
                          <div className={`w-2.5 h-2.5 rounded-full mr-3 flex-shrink-0 ${focused ? 'bg-white' : 'bg-ore-green'}`}></div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`font-minecraft text-[0.9375rem] truncate ${focused ? 'text-white' : 'text-gray-200'}`}>{v.name}</span>
                            <span className="text-[0.6875rem] text-ore-text-muted mt-0.5 truncate">
                              版本: {v.version_number} • {new Date(v.date_published).toLocaleDateString()} 发布
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onInstallVersion(mod, v)}
                          className={`flex shrink-0 items-center gap-1.5 border px-3 py-1.5 font-minecraft text-[0.6875rem] transition-colors ${
                            focused
                              ? 'border-white bg-white text-black'
                              : 'border-ore-green/50 bg-ore-green/10 text-ore-green hover:bg-ore-green hover:text-black'
                          }`}
                        >
                          <Download size={13} />
                          {v.id === mod.manifestEntry?.source.fileId ? '重装' : '安装'}
                        </button>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>
            ) : (
              <div className="text-center text-ore-text-muted py-6 font-minecraft text-[0.8125rem] mx-8 my-4 border-2 border-dashed border-[#2A2A2C] bg-[#1A1A1C]">暂无适配当前实例的额外版本记录</div>
            )}
          </div>
        </FocusBoundary>
      </OreModal>

      <OreModal 
        isOpen={showDeleteConfirm} 
        onClose={handleCloseDeleteConfirm} 
        title="删除模组" 
        className="w-[28.125rem]"
      >
        <FocusBoundary id="mod-delete-confirm-boundary" trapFocus onEscape={handleCloseDeleteConfirm} className="flex flex-col p-6 bg-[#141415]">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-3 bg-red-500/10 rounded-sm border border-red-500/20">
              <AlertTriangle className="text-red-500" size={28} />
            </div>
            <div className="flex-1 mt-1">
              <h3 className="text-white font-minecraft text-base mb-2 relative">
                确定要删除 
                <span className="font-bold underline decoration-red-500/50 underline-offset-4 mx-1.5 inline-block text-[0.9375rem] align-baseline leading-none break-all">{displayMod?.fileName}</span> 
                吗？
              </h3>
              <p className="text-gray-400 text-sm">此操作将会把该模组从实例的 mods 文件夹中移除，删除后无法通过启动器撤销恢复该文件。</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-auto">
            <OreButton focusKey="btn-delete-cancel" variant="secondary" onClick={handleCloseDeleteConfirm} className="w-[6.25rem]">
              取消
            </OreButton>
            <OreButton focusKey="btn-delete-confirm" variant="danger" onClick={handleExecuteDelete} className="w-[8.75rem] font-bold">
              确认删除
            </OreButton>
          </div>
        </FocusBoundary>
      </OreModal>
    </>
  );
};
