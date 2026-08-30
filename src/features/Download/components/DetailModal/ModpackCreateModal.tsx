// /src/features/Download/components/DetailModal/ModpackCreateModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Download, PackagePlus } from 'lucide-react';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreTag } from '../../../../ui/primitives/OreTag';
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
    const trimmed = instanceName.trim() || project?.title || '';
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  if (!isOpen || !version || !project) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={handleClose}
      title="创建整合包实例"
      defaultFocusKey={NAME_INPUT_FOCUS_KEY}
      className="w-[38rem] max-w-[92vw] border-[3px] border-[#1E1E1F] bg-[var(--ore-modal-bg)] shadow-[var(--ore-modal-shadow)] font-minecraft select-none"
      contentClassName="p-4 space-y-3.5"
      actions={
        <div className="flex w-full items-center justify-end gap-3 font-minecraft">
          <OreButton
            focusKey={CANCEL_BUTTON_FOCUS_KEY}
            variant="secondary"
            size="md"
            className="min-w-[6.5rem]"
            onClick={handleClose}
            onArrowPress={(direction) => {
              if (direction === 'up') {
                setFocus(NAME_INPUT_FOCUS_KEY);
                return false;
              }
              if (direction === 'right') {
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
            size="md"
            className="min-w-[10rem]"
            disabled={!instanceName.trim()}
            onClick={handleConfirm}
            onArrowPress={(direction) => {
              if (direction === 'up') {
                setFocus(NAME_INPUT_FOCUS_KEY);
                return false;
              }
              if (direction === 'left') {
                setFocus(CANCEL_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          >
            开始下载与部署
          </OreButton>
        </div>
      }
    >
      {/* 1. 整合包 3D 浮雕信息卡片 */}
      <div className="flex items-start gap-3 border-[2px] border-[#1E1E1F] bg-[#48494A] p-3 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)]">
        {/* 图标槽 */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          {project.icon_url ? (
            <img
              src={project.icon_url}
              alt={project.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <PackagePlus size={24} className="text-[#6CC349]" />
          )}
        </div>

        {/* 右侧详情 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-bold text-white ore-text-shadow">
              {project.title}
            </h4>
            {project.author && (
              <span className="shrink-0 text-xs text-[#D0D1D4]">
                by {project.author}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {version.game_versions?.length > 0 && (
              <OreTag variant="neutral" size="sm" weight="bold">
                MC {version.game_versions.join(', ')}
              </OreTag>
            )}
            {version.loaders?.length > 0 && (
              <OreTag variant="success" size="sm" weight="bold">
                {version.loaders.join(', ')}
              </OreTag>
            )}
            <span
              className="truncate text-xs text-[#D0D1D4] font-['JetBrains_Mono',monospace]"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {version.file_name || version.name}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 实例名称配置输入区 */}
      <div className="space-y-1.5">
        <label
          htmlFor={NAME_INPUT_FOCUS_KEY}
          className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#D0D1D4]"
        >
          <span>实例名称（本地目录与展示名）</span>
          <span className="text-[11px] font-normal text-[#8C8D90]">支持自定义</span>
        </label>
        <OreInput
          id={NAME_INPUT_FOCUS_KEY}
          focusKey={NAME_INPUT_FOCUS_KEY}
          value={instanceName}
          onChange={(event) => setInstanceName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && instanceName.trim()) {
              handleConfirm();
            }
          }}
          placeholder="请输入新实例名称"
          className="font-minecraft"
          onArrowPress={(direction) => {
            if (direction === 'down') {
              setFocus(CONFIRM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        />
      </div>

      {/* 3. 下沉式温馨提示矿槽 */}
      <div className="flex items-center gap-2 border-[2px] border-[#1E1E1F] bg-[#222324] px-3 py-2 text-xs text-[#D0D1D4] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        <Download size={14} className="shrink-0 text-[#6CC349]" />
        <span>自动创建本地实例并下载游戏核心与关联模组。</span>
      </div>
    </OreModal>
  );
};

export default ModpackCreateModal;