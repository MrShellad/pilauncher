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
    <SettingsPageLayout>
      <ModPanelTopBar
        {...controller.topBar}
        onArrowPress={focusNavigation.handleTopBarArrow}
      />

      <ModList
        {...controller.list}
        onNavigateOut={focusNavigation.handleListNavigateOut}
      />

      <ModPanelDialogs
        instanceConfig={controller.state.instanceConfig}
        mods={controller.state.mods}
        snapshotState={controller.state.snapshotState}
        state={controller.dialogs.state}
        actions={controller.dialogs.actions}
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
    </SettingsPageLayout>
  );
};
