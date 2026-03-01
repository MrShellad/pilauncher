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
    if (mod) {
      setDisplayMod(mod);
      setModVersions([]);
      setTimeout(() => setFocus('mod-btn-toggle'), 50);

      if (mod.networkInfo?.id && instanceConfig?.game_version) {
        setIsLoadingVersions(true);
        fetchModrinthVersions(mod.networkInfo.id, instanceConfig.game_version, instanceConfig.loader_type)
          .then(setModVersions)
          .catch(console.error)
          .finally(() => setIsLoadingVersions(false));
      }
    }
  }, [mod, instanceConfig]);

  if (!displayMod) return null;

  const handleToggle = () => onToggle(displayMod.fileName, displayMod.isEnabled);
  
  const handleDelete = async () => {
    const confirmed = await ask(`确定要彻底删除模组 "${displayMod.fileName}" 吗？此操作不可逆！`, { title: '危险操作确认', kind: 'warning' });
    if (confirmed) {
      onDelete(displayMod.fileName);
      onClose();
    }
  };

  return (
    // ✅ 修复 2：将 max-w-3xl 缩小到 max-w-2xl，并且彻底干掉固定高度属性 (h-[80vh] min-h-[500px])
    <OreModal isOpen={!!mod} onClose={onClose} hideTitleBar={true} className="w-full max-w-2xl">
      <FocusBoundary id="mod-modal-boundary" className="flex flex-col">
        
        {/* 信息展示区域 */}
        <div className="flex flex-col items-center justify-center p-8 pt-10 text-center">
          <div className={`w-24 h-24 bg-[#18181B] border-2 border-[#2A2A2C] flex items-center justify-center p-2 rounded shadow-lg ${!displayMod.isEnabled ? 'grayscale opacity-50' : ''}`}>
            {displayMod.iconAbsolutePath ? <img src={`${convertFileSrc(displayMod.iconAbsolutePath)}?t=${Date.now()}`} className="w-full h-full object-contain" />
              : (displayMod.networkIconUrl || displayMod.networkInfo?.icon_url) ? <img src={displayMod.networkIconUrl || displayMod.networkInfo?.icon_url} className="w-full h-full object-contain" />
              : <Blocks size={40} className="text-ore-text-muted/50 drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" />}
          </div>
          
          <h2 className={`mt-5 text-3xl font-minecraft drop-shadow-md ${!displayMod.isEnabled ? 'text-gray-500 line-through' : 'text-white'}`}>
            {displayMod.name || displayMod.networkInfo?.title || displayMod.fileName}
          </h2>
          
          <p className="mt-3 text-sm text-gray-400 max-w-xl line-clamp-3 leading-snug">
            {displayMod.description || displayMod.networkInfo?.description || "该模组暂无描述。"}
          </p>
        </div>

        {/* 核心操作栏 */}
        <div className="flex items-center justify-center space-x-6 px-8 py-5 border-t-2 border-[#1E1E1F] bg-[#141415]/50">
          <OreButton 
            focusKey="mod-btn-toggle" 
            variant={displayMod.isEnabled ? 'secondary' : 'primary'} 
            onClick={handleToggle}
            className="w-48"
          >
            <Power size={18} className="mr-2" />
            {displayMod.isEnabled ? '禁用该模组' : '重新启用模组'}
          </OreButton>

          <OreButton 
            focusKey="mod-btn-delete" 
            variant="danger" 
            onClick={handleDelete}
            className="w-48"
          >
            <Trash2 size={18} className="mr-2" />
            彻底删除
          </OreButton>
        </div>

        {/* ✅ 修复 3：移除 flex-1 撑满属性，将其作为一个普通流块展示 */}
        <div className="bg-[#18181B] border-t-2 border-[#2A2A2C] flex flex-col">
          <div className="flex justify-between items-center px-8 py-3 border-b-2 border-[#1E1E1F]">
            <h3 className="text-gray-400 font-minecraft text-sm">可用版本更新 / 回滚</h3>
            {instanceConfig?.game_version && <span className="text-xs text-ore-green bg-ore-green/10 px-2 py-0.5 rounded">匹配: {instanceConfig?.game_version}</span>}
          </div>
          
          {isLoadingVersions ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="animate-spin text-ore-text-muted" /></div>
          ) : modVersions.length > 0 ? (
            // ✅ 设定一个极限最大高度 (max-h-[35vh])，超过才会出现滚动条，不足则完美收缩贴合内容！
            <div className="overflow-y-auto custom-scrollbar max-h-[35vh]">
              {modVersions.map(v => (
                <FocusItem key={v.id} onEnter={() => alert(`准备下载版本: ${v.version_number}`)}>
                  {({ref, focused}) => (
                    <div ref={ref as any} onClick={() => alert(`准备下载版本: ${v.version_number}`)}
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
            <div className="text-center text-ore-text-muted py-8 font-minecraft text-sm mx-8 my-6 border-2 border-[#1E1E1F] border-dashed">
              未找到匹配的 MOD 版本。
            </div>
          )}
        </div>
        
      </FocusBoundary>
    </OreModal>
  );
};