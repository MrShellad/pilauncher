import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { OreConfirmDialog } from '../../../../../ui/primitives/OreConfirmDialog';

import type { ModMeta } from '../../../logic/modService';
import type { OreProjectVersion } from '../../../logic/modrinthApi';
import { ModSnapshotModal } from '../ModSnapshotModal';
import { ModDetailModal } from './ModDetailModal';
import type { ModPanelDialogActions, ModPanelDialogState } from './useModPanelDialogs';

interface ModPanelDialogsProps {
  instanceConfig: any;
  mods: ModMeta[];
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  state: ModPanelDialogState;
  actions: ModPanelDialogActions;
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion) => void;
}

export const ModPanelDialogs: React.FC<ModPanelDialogsProps> = ({
  instanceConfig,
  mods,
  snapshotState,
  state,
  actions,
  onInstallVersion
}) => {
  return (
    <>
      <ModDetailModal
        mod={state.selectedMod}
        instanceConfig={instanceConfig}
        onClose={actions.closeModDetail}
        onToggle={actions.toggleSelectedMod}
        onDelete={actions.deleteModFromDetail}
        onInstallVersion={onInstallVersion}
      />

      <ModSnapshotModal
        isOpen={state.isHistoryModalOpen}
        onClose={actions.closeHistoryModal}
        history={state.history}
        currentMods={mods}
        diffs={state.diffs}
        onDiffRequest={actions.loadDiff}
        onRollback={actions.rollbackSnapshot}
        isRollingBack={snapshotState === 'rolling_back'}
      />

      <OreConfirmDialog
        isOpen={state.pendingDelete !== null}
        onClose={actions.closeDeleteConfirm}
        onConfirm={actions.confirmDelete}
        title={state.pendingDelete?.title ?? '删除模组'}
        headline={state.pendingDelete?.description}
        confirmLabel="确认删除"
        cancelLabel="取消"
        confirmVariant="danger"
        confirmFocusKey="mod-delete-confirm"
        cancelFocusKey="mod-delete-cancel"
        className="w-full max-w-lg"
        dialogIcon={<AlertTriangle size={24} className="text-red-400" />}
        confirmationNote="删除后无法通过启动器撤销。"
        confirmationNoteTone="danger"
      />
    </>
  );
};
