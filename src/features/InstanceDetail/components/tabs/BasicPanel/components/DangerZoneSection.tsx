import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { OreConfirmDialog } from '../../../../../../ui/primitives/OreConfirmDialog';
import { useDangerZoneSection } from '../hooks/useDangerZoneSection';
import type { DangerZoneSectionProps } from '../schemas/basicPanelSchemas';

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  instanceName,
  isInitializing,
  onDelete,
  isGlobalSaving,
  setIsGlobalSaving,
}) => {
  const {
    isDeleteModalOpen,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
  } = useDangerZoneSection({ onDelete, setIsGlobalSaving });

  return (
    <>
      <SettingsSection title="危险区域" icon={<AlertTriangle size="1.125rem" />} danger>
        <FormRow
          label="彻底删除实例"
          description="此操作不可逆，将永久删除该实例的所有本地文件与存档。"
          control={
            <OreButton
              focusKey="basic-btn-delete-instance"
              variant="danger"
              onClick={openDeleteModal}
              disabled={isGlobalSaving || isInitializing}
              className="w-40"
            >
              <Trash2 size="1rem" className="mr-2" /> 彻底删除
            </OreButton>
          }
        />
      </SettingsSection>

      <OreConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="警告：彻底删除实例"
        headline={
          <>
            您确定要彻底删除实例 <span className="font-bold text-red-400">"{instanceName}"</span> 吗？
          </>
        }
        description="此操作无法撤销，与该实例相关的所有配置、模组以及游戏存档都会被永久清除。"
        confirmLabel="强制删除"
        cancelLabel="取消"
        confirmVariant="danger"
        confirmFocusKey="basic-modal-btn-confirm"
        cancelFocusKey="basic-modal-btn-cancel"
        confirmIcon={<Trash2 size="1rem" className="mr-2" />}
        dialogIcon={<Trash2 size="2rem" className="text-red-500" />}
        isConfirming={isGlobalSaving}
      />
    </>
  );
};
