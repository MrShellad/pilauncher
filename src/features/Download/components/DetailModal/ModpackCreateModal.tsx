// /src/features/Download/components/DetailModal/ModpackCreateModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { PackagePlus } from 'lucide-react';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { OreProjectVersion, ModrinthProject } from '../../../InstanceDetail/logic/modrinthApi';

interface ModpackCreateModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  project: ModrinthProject | null;
  onClose: () => void;
  onConfirm: (instanceName: string) => void;
}

const NAME_INPUT_FOCUS_KEY = 'modpack-create-name-input';
const CANCEL_BUTTON_FOCUS_KEY = 'modpack-create-cancel';
const CONFIRM_BUTTON_FOCUS_KEY = 'modpack-create-confirm';

export const ModpackCreateModal: React.FC<ModpackCreateModalProps> = ({
  isOpen,
  version,
  project,
  onClose,
  onConfirm
}) => {
  const [instanceName, setInstanceName] = useState('');
  const lastFocusBeforeModalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !project) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }

    setInstanceName(project.title);
  }, [isOpen, project]);

  const restorePreviousFocus = () => {
    const lastFocus = lastFocusBeforeModalRef.current;
    if (lastFocus && doesFocusableExist(lastFocus)) {
      setFocus(lastFocus);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(restorePreviousFocus, 50);
  };

  const handleConfirm = () => {
    onConfirm(instanceName.trim() || project?.title || '');
  };

  if (!isOpen || !version || !project) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={handleClose}
      hideTitleBar={false}
      defaultFocusKey={NAME_INPUT_FOCUS_KEY}
      className="w-full max-w-lg bg-[#18181B] p-0"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="p-5 border-b border-white/5 bg-black/40 text-sm text-gray-300">
        <div className="mb-1 flex items-center font-minecraft text-lg text-white">
          <PackagePlus size={20} className="mr-2 text-ore-green" />
          创建整合包实例
        </div>
        <div className="mt-2 text-xs text-gray-400">
          准备下载：<span className="font-bold text-ore-green">{version.file_name}</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          依赖环境：Minecraft {version.game_versions.join(', ')} | {version.loaders.join(', ')}
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-bold tracking-wider text-ore-text-muted">
            实例名称（支持自定义）
          </label>
          <OreInput
            focusKey={NAME_INPUT_FOCUS_KEY}
            value={instanceName}
            onChange={(event) => setInstanceName(event.target.value)}
            placeholder="输入实例名称"
            className="bg-black/50 border-[#2A2A2C] text-white font-minecraft focus:border-ore-green/50"
            onArrowPress={(direction) => {
              if (direction === 'DOWN') {
                setFocus(CONFIRM_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3 border-t border-white/5 bg-black/60 p-4">
        <OreButton
          focusKey={CANCEL_BUTTON_FOCUS_KEY}
          variant="secondary"
          onClick={handleClose}
          onArrowPress={(direction) => {
            if (direction === 'UP') {
              setFocus(NAME_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'RIGHT') {
              setFocus(CONFIRM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        >
          取消
        </OreButton>
        <OreButton
          focusKey={CONFIRM_BUTTON_FOCUS_KEY}
          variant="primary"
          disabled={!instanceName.trim()}
          onClick={handleConfirm}
          onArrowPress={(direction) => {
            if (direction === 'UP') {
              setFocus(NAME_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'LEFT') {
              setFocus(CANCEL_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        >
          开始下载与部署
        </OreButton>
      </div>
    </OreModal>
  );
};
