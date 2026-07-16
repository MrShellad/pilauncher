import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreConfirmDialog } from '../../../../../../../ui/primitives/OreConfirmDialog';

import type { ModMeta, ModMetadataSettings, ModVersionInstallAction } from '../../../../../logic/modService';
import type { OreProjectVersion } from '../../../../../logic/modrinthApi';
import { ModSnapshotModal } from '../../../ModSnapshotModal';
import { ModDetailModal } from './ModDetailModal';
import { GlobalModMetadataModal } from './GlobalModMetadataModal';
import type { ModPanelDialogActions, ModPanelDialogState } from '../../hooks/useModPanelDialogs';

interface ModPanelDialogsProps {
  instanceConfig: any;
  instanceId?: string;
  mods: ModMeta[];
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  state: ModPanelDialogState;
  actions: ModPanelDialogActions;
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion, action: ModVersionInstallAction) => void;
  onSaveMetadataSettings: (mod: ModMeta, settings: ModMetadataSettings) => Promise<ModMeta>;
  onReidentifyMod: (mod: ModMeta) => Promise<ModMeta>;
  onMetadataResolved: (mod: ModMeta) => void;
  onSaveGlobalMetadataSettings: (settings: ModMetadataSettings) => Promise<void>;
  onReidentifyAllMods: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  onAddFavorite: (mod: ModMeta) => void;
}

export const ModPanelDialogs: React.FC<ModPanelDialogsProps> = ({
  instanceConfig,
  instanceId,
  mods,
  snapshotState,
  state,
  actions,
  onInstallVersion,
  onSaveMetadataSettings,
  onReidentifyMod,
  onMetadataResolved,
  onSaveGlobalMetadataSettings,
  onReidentifyAllMods,
  onAddFavorite
}) => {
  const { t } = useTranslation();
  const currentGlobalSettings = React.useMemo(() => {
    if (instanceConfig?.globalMetadataSettings) {
      return instanceConfig.globalMetadataSettings;
    }
    const firstWithSettings = mods.find(m => m.manifestEntry?.metadataSettings);
    return firstWithSettings?.manifestEntry?.metadataSettings;
  }, [instanceConfig, mods]);

  return (
    <>
      <ModDetailModal
        mod={state.selectedMod}
        allMods={mods}
        instanceConfig={instanceConfig}
        instanceId={instanceId}
        onClose={actions.closeModDetail}
        onToggle={actions.toggleSelectedMod}
        onDelete={actions.deleteModFromDetail}
        onInstallVersion={onInstallVersion}
        onSaveMetadataSettings={onSaveMetadataSettings}
        onReidentifyMod={onReidentifyMod}
        onMetadataResolved={onMetadataResolved}
        onAddFavorite={onAddFavorite}
        openMetadataSettingsOnOpen={state.openMetadataSettingsOnDetailOpen}
        onMetadataSettingsOpenHandled={actions.markMetadataSettingsOpened}
      />

      <GlobalModMetadataModal
        isOpen={state.isGlobalMetadataOpen}
        onClose={actions.closeGlobalMetadata}
        currentSettings={currentGlobalSettings}
        onSaveMetadataSettings={onSaveGlobalMetadataSettings}
        onReidentifyAllMods={onReidentifyAllMods}
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
        title={state.pendingDelete?.title ?? t('instanceDetail.mods.deleteDialog.title', { defaultValue: '删除模组' })}
        headline={state.pendingDelete?.description}
        confirmLabel={t('instanceDetail.mods.deleteDialog.confirmLabel', { defaultValue: '确认删除' })}
        cancelLabel={t('instanceDetail.mods.deleteDialog.cancelLabel', { defaultValue: '取消' })}
        confirmVariant="danger"
        confirmFocusKey="mod-delete-confirm"
        cancelFocusKey="mod-delete-cancel"
        className="w-full max-w-lg"
        dialogIcon={<AlertTriangle size={24} className="text-red-400" />}
        confirmationNote={t('instanceDetail.mods.deleteDialog.confirmationNote', { defaultValue: '删除后无法通过启动器撤销。' })}
        confirmationNoteTone="danger"
      />
    </>
  );
};
