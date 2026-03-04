// /src/features/Download/components/DetailModal/ModpackCreateModal.tsx
import React, { useState, useEffect } from 'react';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { PackagePlus } from 'lucide-react';
import type { OreProjectVersion, ModrinthProject } from '../../../InstanceDetail/logic/modrinthApi';

interface ModpackCreateModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  project: ModrinthProject | null;
  onClose: () => void;
  onConfirm: (instanceName: string) => void;
}

export const ModpackCreateModal: React.FC<ModpackCreateModalProps> = ({ 
  isOpen, version, project, onClose, onConfirm 
}) => {
  const [instanceName, setInstanceName] = useState('');

  // 每次打开时，默认填入整合包原本的名字
  useEffect(() => {
    if (isOpen && project) {
      setInstanceName(project.title);
    }
  }, [isOpen, project]);

  if (!isOpen || !version || !project) return null;

  return (
    <OreModal isOpen={isOpen} onClose={onClose} hideTitleBar={false} className="w-full max-w-lg bg-[#18181B] p-0">
      <FocusBoundary id="modpack-create-boundary" className="flex flex-col">
        <div className="p-5 border-b border-white/5 bg-black/40 text-sm text-gray-300">
          <div className="font-minecraft text-lg text-white mb-1 flex items-center">
            <PackagePlus size={20} className="mr-2 text-ore-green" />
            配置整合包实例
          </div>
          <div className="mt-2 text-xs text-gray-400">
            准备下载：<span className="text-ore-green font-bold">{version.file_name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            依赖环境：Minecraft {version.game_versions.join(', ')} | {version.loaders.join(', ')}
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col space-y-2">
            <label className="text-sm text-ore-text-muted font-bold tracking-wider">实例名称 (支持自定义)</label>
            <OreInput 
              focusKey="modpack-name-input"
              value={instanceName} 
              onChange={(e) => setInstanceName(e.target.value)} 
              placeholder="输入实例名称"
              className="bg-black/50 border-[#2A2A2C] focus:border-ore-green/50 text-white font-minecraft"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/60 flex justify-end gap-3 mt-2">
          <FocusItem focusKey="btn-cancel" onEnter={onClose}>
            {({ ref, focused }) => (
              <div ref={ref as any} className={`rounded-sm transition-all ${focused ? 'ring-2 ring-white scale-105' : ''}`}>
                <OreButton variant="secondary" onClick={onClose} tabIndex={-1}>取消</OreButton>
              </div>
            )}
          </FocusItem>
          <FocusItem focusKey="btn-confirm" onEnter={() => onConfirm(instanceName || project.title)}>
            {({ ref, focused }) => (
              <div ref={ref as any} className={`rounded-sm transition-all ${focused ? 'ring-2 ring-white scale-105' : ''}`}>
                <OreButton variant="primary" disabled={!instanceName} onClick={() => onConfirm(instanceName || project.title)} tabIndex={-1}>
                  开始下载与部署
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </FocusBoundary>
    </OreModal>
  );
};