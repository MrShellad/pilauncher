// /src/features/Download/components/DetailModal/InstanceSelectModal.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Monitor, CheckCircle2, BoxSelect, Loader2 } from 'lucide-react';
import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';

interface InstanceSelectModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  onClose: () => void;
  onConfirm: (instanceId: string) => void;
  ignoreLoader?: boolean; 
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({ 
  isOpen, version, onClose, onConfirm, ignoreLoader = false 
}) => {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && version) {
      setIsLoading(true);
      invoke<any[]>('get_compatible_instances', {
        gameVersions: version.game_versions,
        loaders: version.loaders,
        ignoreLoader 
      })
        .then(list => {
          setInstances(list || []);
          if (list && list.length > 0) setSelectedId(list[0].id);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setSelectedId('');
      setInstances([]);
    }
  }, [isOpen, version, ignoreLoader]);

  if (!isOpen || !version) return null;

  return (
    <OreModal 
      isOpen={isOpen} 
      onClose={onClose} 
      hideTitleBar={false} 
      title="选择安装目标"
      className="w-full max-w-lg bg-[#18181B] border-[2px] border-[#313233]"
      contentClassName="p-0 flex flex-col overflow-hidden" // 移除默认 padding 方便分段布局
    >
      {/* 1. 顶部提示区 */}
      <div className="p-5 border-b border-white/5 bg-black/40 text-sm text-gray-300 flex-shrink-0">
        <div className="font-minecraft text-lg text-white mb-1">目标实例确认</div>
        准备部署：<span className="text-ore-green font-bold truncate inline-block max-w-full align-bottom">{version.file_name}</span>
        <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">
          环境需求：MC {version.game_versions[0]} {ignoreLoader ? '' : `| ${version.loaders.join(', ')}`}
        </div>
      </div>

      {/* 2. 实例列表区：使用独立 Boundary 隔离导航 */}
      <FocusBoundary id="instance-list-boundary" className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[300px] max-h-[50vh] bg-[#111112]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-ore-green opacity-80 py-12">
            <Loader2 className="animate-spin mb-3" size={32} />
            <span className="font-minecraft text-sm">正在匹配兼容的实例...</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BoxSelect size={48} className="mb-4 opacity-50" />
            <div className="font-minecraft text-lg text-white mb-1 text-center">未找到匹配实例</div>
            <div className="text-xs text-center px-8">此 Mod 的运行环境与您现有的实例不兼容，请先创建一个匹配的实例。</div>
          </div>
        ) : (
          instances.map(inst => {
            const isSelected = selectedId === inst.id;
            return (
              <FocusItem key={inst.id} focusKey={`inst-item-${inst.id}`} onEnter={() => setSelectedId(inst.id)}>
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    onClick={() => setSelectedId(inst.id)}
                    className={`
                      relative group flex items-center p-3 rounded-sm border transition-all cursor-pointer overflow-hidden
                      ${isSelected ? 'border-ore-green bg-ore-green/10' : 'border-white/5 bg-black/30 hover:border-white/20'}
                      ${focused ? 'ring-2 ring-white scale-[1.02] brightness-110 z-10 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}
                    `}
                  >
                    <Monitor size={24} className={`mr-4 transition-colors ${isSelected ? 'text-ore-green' : 'text-blue-400 opacity-60'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-minecraft truncate text-base ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>{inst.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{inst.version} | {inst.loader}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="text-ore-green ml-3" size={20} />}
                  </div>
                )}
              </FocusItem>
            );
          })
        )}
      </FocusBoundary>

      {/* 3. 底部操作区：为 OreButton 显式指定 focusKey */}
      <div className="p-4 border-t border-white/10 bg-black/60 flex justify-end gap-4 flex-shrink-0">
        <OreButton 
          focusKey="modal-inst-cancel" 
          variant="secondary" 
          onClick={onClose}
        >
          取消
        </OreButton>
        <OreButton 
          focusKey="modal-inst-confirm" 
          variant="primary" 
          disabled={!selectedId || isLoading} 
          onClick={() => onConfirm(selectedId)}
          className="font-bold tracking-widest text-black"
        >
          确认并安装
        </OreButton>
      </div>
    </OreModal>
  );
};