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
  ignoreLoader?: boolean; // ✅ 新增：是否忽略 Loader 检查
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
        ignoreLoader // ✅ 传给后端
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
    <OreModal isOpen={isOpen} onClose={onClose} hideTitleBar={false} className="w-full max-w-lg bg-[#18181B] p-0">
      <FocusBoundary id="instance-select-boundary" className="flex flex-col max-h-[70vh]">
        <div className="p-5 border-b border-white/5 bg-black/40 text-sm text-gray-300">
          <div className="font-minecraft text-lg text-white mb-1">选择目标实例</div>
          即将下载：<span className="text-ore-green font-bold">{version.file_name}</span>
          <div className="text-xs text-gray-500 mt-1">
            要求：{version.game_versions[0]} {ignoreLoader ? '' : `| ${version.loaders.join(', ')}`}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-ore-green opacity-80 py-12">
              <Loader2 className="animate-spin mb-3" size={32} />
              <span className="font-minecraft text-sm">正在匹配兼容的实例...</span>
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <BoxSelect size={48} className="mb-4 opacity-50" />
              <div className="font-minecraft text-lg text-white mb-1">无兼容的游戏实例</div>
              <div className="text-sm">当前 Mod 版本没有可用的本地实例</div>
            </div>
          ) : (
            instances.map(inst => {
              const isSelected = selectedId === inst.id;
              return (
                <FocusItem key={inst.id} onEnter={() => setSelectedId(inst.id)}>
                  {({ ref, focused }) => (
                    <div
                      ref={ref as any}
                      onClick={() => setSelectedId(inst.id)}
                      className={`flex items-center p-3 rounded-sm border transition-all cursor-pointer
                        ${isSelected ? 'border-ore-green bg-ore-green/10' : 'border-white/10 hover:border-white/30 bg-black/40'}
                        ${focused ? 'ring-2 ring-white scale-[1.02] brightness-110 shadow-lg z-10' : ''}`}
                    >
                      <Monitor size={24} className="mr-4 text-blue-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-minecraft truncate text-base">{inst.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{inst.version} | {inst.loader}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="text-ore-green ml-3" size={24} />}
                    </div>
                  )}
                </FocusItem>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/60 flex justify-end gap-3">
          <OreButton variant="secondary" onClick={onClose}>取消</OreButton>
          <OreButton variant="primary" disabled={!selectedId} onClick={() => onConfirm(selectedId)}>确认下载</OreButton>
        </div>
      </FocusBoundary>
    </OreModal>
  );
};