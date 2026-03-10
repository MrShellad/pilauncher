// /src/features/InstanceDetail/components/tabs/mods/ModDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Loader2, Trash2, Power, ChevronRight } from 'lucide-react';
import { fetchModrinthVersions } from '../../../logic/modrinthApi';
import type { ModMeta } from '../../../logic/modService';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
  onClose: () => void;
  onToggle: (fileName: string, currentEnabled: boolean) => void;
  onDelete: (fileName: string) => void;
}

export const ModDetailModal: React.FC<ModDetailModalProps> = ({ mod, instanceConfig, onClose, onToggle, onDelete }) => {
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [displayMod, setDisplayMod] = useState<ModMeta | null>(null);

  useEffect(() => {
    if (mod) setDisplayMod(mod);
  }, [mod]);

  useEffect(() => {
    if (mod) {
      setTimeout(() => setFocus('btn-mod-toggle'), 100);
    }
  }, [mod]);

  useEffect(() => {
    if (mod?.networkInfo && instanceConfig) {
      setIsLoadingVersions(true);
      const targetLoader = instanceConfig.loader?.type?.toLowerCase() === 'vanilla' ? '' : instanceConfig.loader?.type?.toLowerCase();
      fetchModrinthVersions(mod.networkInfo.id, instanceConfig.mcVersion, targetLoader)
        .then(res => setModVersions(res.slice(0, 5))) 
        .catch(err => console.error("获取版本失败:", err))
        .finally(() => setIsLoadingVersions(false));
    } else {
      setModVersions([]);
    }
  }, [mod, instanceConfig]);

  const handleDelete = async () => {
    if (!mod) return;
    const directDelete = await ask(`确定要删除模组 ${mod.fileName} 吗？\n该操作无法撤销。`, { title: '删除模组确认', kind: 'warning' });
    if (directDelete) {
      onDelete(mod.fileName);
      onClose();
    }
  };

  if (!mod) return null;

  const displayDesc = displayMod?.description || displayMod?.networkInfo?.description || "没有提供该模组的描述。";
  
  // ✅ 修复缓存穿透：生成稳定的 CacheKey
  const cacheKey = displayMod?.modifiedAt || displayMod?.fileSize || displayMod?.fileName || 'cache';

  return (
    <OreModal isOpen={!!mod} onClose={onClose} title={displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName} className="w-[800px] h-[70vh]">
      <FocusBoundary id="mod-detail-boundary" trapFocus onEscape={onClose} className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#141415]">
        <div className="flex space-x-6">
          <div className="w-32 h-32 flex-shrink-0 bg-[#1E1E1F] border-2 border-[#2A2A2C] shadow-inner flex items-center justify-center p-2 rounded-sm relative">
            {mod.isFetchingNetwork && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-ore-green" /></div>}
            
            {displayMod?.iconAbsolutePath || displayMod?.networkIconUrl || displayMod?.networkInfo?.icon_url ? (
              // ✅ 移除 Date.now()，使用稳定的 t 参数
              <img src={displayMod.iconAbsolutePath ? `${convertFileSrc(displayMod.iconAbsolutePath)}?t=${cacheKey}` : (displayMod.networkIconUrl || displayMod.networkInfo?.icon_url)} alt="icon" className="w-full h-full object-cover" />
            ) : <Blocks size={48} className="text-gray-600" />}
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-minecraft text-white drop-shadow-sm flex items-center">
              {displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}
              {!displayMod?.isEnabled && <span className="ml-3 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">已禁用</span>}
            </h2>
            <div className="mt-2 text-sm text-gray-400 space-y-1">
              <p>文件名称: {displayMod?.fileName}</p>
              <p>文件大小: {displayMod?.fileSize ? (displayMod.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}</p>
              <p>识别状态: {mod.isFetchingNetwork ? '正在匹配...' : (displayMod?.networkInfo ? '✅ 已链接至 Modrinth' : '未找到匹配项目')}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 border-b-2 border-white/5 pb-6">
          <OreButton focusKey="btn-mod-toggle" variant={displayMod?.isEnabled ? 'secondary' : 'primary'} onClick={() => onToggle(mod.fileName, !!displayMod?.isEnabled)}>
            <Power size={18} className="mr-2" /> {displayMod?.isEnabled ? "点击禁用" : "点击启用"}
          </OreButton>
          <OreButton focusKey="btn-mod-delete" variant="danger" onClick={handleDelete}>
            <Trash2 size={18} className="mr-2" /> 删除该模组
          </OreButton>
        </div>

        <div className="mt-6">
          <h3 className="font-minecraft text-white text-lg mb-2">描述</h3>
          <p className="text-sm text-gray-300 leading-relaxed bg-[#1E1E1F] p-4 rounded-sm border-2 border-[#2A2A2C] shadow-inner">{displayDesc}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-minecraft text-white text-lg mb-2">版本历史 (当前实例)</h3>
          {isLoadingVersions ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-ore-green" /></div>
          ) : modVersions.length > 0 ? (
            <div className="bg-[#1E1E1F] border-2 border-[#2A2A2C] rounded-sm shadow-inner overflow-hidden">
              {modVersions.map((v, i) => (
                <FocusItem key={i} focusKey={`mod-version-${i}`}>
                  {({ ref, focused }) => (
                    <div 
                      ref={ref as any}
                      className={`flex justify-between items-center py-3.5 px-8 bg-[#18181B] border-b-2 outline-none transition-all cursor-pointer ${focused ? 'border-white bg-[#2A2A2C] scale-[1.002] z-10 brightness-110' : 'border-[#1E1E1F] hover:bg-[#1C1C1E]'}`}
                    >
                      <div className="flex items-center flex-1 min-w-0 pr-4">
                        <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${focused ? 'bg-white' : 'bg-ore-green'}`}></div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`font-minecraft truncate ${focused ? 'text-white' : 'text-gray-200'}`}>{v.name}</span>
                          <span className="text-xs text-ore-text-muted mt-1 truncate">
                            版本: {v.version_number} • {new Date(v.date_published).toLocaleDateString()} 发布
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={20} className={focused ? 'text-white' : 'text-gray-600'} />
                    </div>
                  )}
                </FocusItem>
              ))}
            </div>
          ) : (
            <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm mx-8 my-6 border-2 border-dashed border-[#2A2A2C] bg-[#1A1A1C]">暂无适配当前实例的额外版本记录</div>
          )}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};