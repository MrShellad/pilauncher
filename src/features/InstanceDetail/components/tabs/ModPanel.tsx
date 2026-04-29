import React from 'react';

import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';

import { ModList } from './mods/ModList';
import { ModPanelDialogs } from './mods/ModPanelDialogs';
import { ModPanelTopBar } from './mods/ModPanelTopBar';
import { useModPanelController } from './mods/useModPanelController';
import { useModPanelFocusNavigation } from './mods/useModPanelFocusNavigation';

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const controller = useModPanelController(instanceId);
  const focusNavigation = useModPanelFocusNavigation(controller.state.isBatchMode);

  return (
    <SettingsPageLayout width="wide" className="[&_.ore-settings-page-layout__content]:gap-2">
      <ModPanelTopBar
        {...controller.topBar}
        onArrowPress={focusNavigation.handleTopBarArrow}
      />

      <ModList
        {...controller.list}
        onHeaderArrowPress={focusNavigation.handleTopBarArrow}
        onNavigateOut={focusNavigation.handleListNavigateOut}
      />

      <ModPanelDialogs
        instanceConfig={controller.state.instanceConfig}
        mods={controller.state.mods}
        snapshotState={controller.state.snapshotState}
        state={controller.dialogs.state}
        actions={controller.dialogs.actions}
        onInstallVersion={controller.modActions.onInstallVersion}
      />

      <OreConfirmDialog
        isOpen={controller.cleanupDialog.isOpen}
        onClose={controller.cleanupDialog.onClose}
        onConfirm={controller.cleanupDialog.onConfirm}
        title={controller.cleanupDialog.title}
        headline={controller.cleanupDialog.headline}
        confirmLabel={controller.cleanupDialog.confirmLabel}
        cancelLabel={controller.cleanupDialog.cancelLabel}
        confirmVariant="primary"
        confirmFocusKey="mod-cleanup-confirm"
        cancelFocusKey="mod-cleanup-cancel"
        className="w-full max-w-2xl"
      >
        <div className="mt-4 max-h-64 overflow-y-auto rounded bg-[#18181B] p-2 text-left text-sm text-gray-300">
          {controller.cleanupDialog.items?.map((item, index) => (
            <div key={`${item.originalFileName}-${index}`} className="mb-2 border-b border-[#2A2A2C] pb-2 last:border-0 last:pb-0">
              <div className="line-through opacity-80 text-red-400">{item.originalFileName}</div>
              <div className="text-ore-green">{item.suggestedFileName}</div>
            </div>
          ))}
        </div>
      </OreConfirmDialog>

      <OreConfirmDialog
        isOpen={controller.upgradeSnapshotDialog.isOpen}
        onClose={controller.upgradeSnapshotDialog.onClose}
        onConfirm={controller.upgradeSnapshotDialog.onConfirm}
        title="升级前创建快照"
        headline="建议先记录当前模组状态"
        description={
          controller.upgradeSnapshotDialog.mod
            ? `首次升级模组前，可以创建一个快照，之后如果新版本不稳定，可在历史快照中快速回退。即将升级：${controller.upgradeSnapshotDialog.mod.fileName}`
            : undefined
        }
        confirmLabel={controller.upgradeSnapshotDialog.isCreatingSnapshot ? '创建中...' : '创建快照并升级'}
        cancelLabel="取消"
        confirmVariant="primary"
        tone="warning"
        confirmFocusKey="mod-upgrade-snapshot-confirm"
        cancelFocusKey="mod-upgrade-snapshot-cancel"
        isConfirming={controller.upgradeSnapshotDialog.isCreatingSnapshot}
        closeOnOutsideClick={!controller.upgradeSnapshotDialog.isCreatingSnapshot}
        className="w-full max-w-xl"
        confirmationNote="这个提示只会在本实例本次进入页面后的第一次升级时出现。"
        confirmationNoteTone="info"
        tertiaryAction={{
          label: '直接升级',
          onClick: controller.upgradeSnapshotDialog.onSkip,
          variant: 'secondary',
          focusKey: 'mod-upgrade-snapshot-skip',
          disabled: controller.upgradeSnapshotDialog.isCreatingSnapshot
        }}
      />
    </SettingsPageLayout>
  );
};
