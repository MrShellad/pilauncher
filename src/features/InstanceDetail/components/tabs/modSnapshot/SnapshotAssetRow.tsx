import React from 'react';
import type { TFunction } from 'i18next';
import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import { getDisplayFileName, resolveEnabledState, type SnapshotModEntry } from './modSnapshotUtils';

export interface SnapshotAssetRowProps {
  mod: SnapshotModEntry;
  label: React.ReactNode;
  description?: React.ReactNode;
  t: TFunction;
}

const buildMetaItems = (mod: SnapshotModEntry, t: TFunction): string[] => {
  const items = [
    t('modSnapshots.meta.file', {
      defaultValue: 'File: {{fileName}}',
      fileName: mod.fileName
    }),
    t('modSnapshots.meta.sha1', {
      defaultValue: 'SHA1: {{hash}}',
      hash: mod.hash.slice(0, 10)
    })
  ];

  if (mod.version) {
    items.push(
      t('modSnapshots.meta.version', {
        defaultValue: 'Version: {{version}}',
        version: mod.version
      })
    );
  }

  if (mod.modId) {
    items.push(
      t('modSnapshots.meta.project', {
        defaultValue: 'Project: {{modId}}',
        modId: mod.modId
      })
    );
  }

  return items;
};

export const SnapshotAssetRow: React.FC<SnapshotAssetRowProps> = ({ mod, label, description, t }) => {
  return (
    <OreAssetRow
      key={`${mod.hash}-${mod.fileName}`}
      focusable={false}
      title={getDisplayFileName(mod)}
      description={description}
      badges={
        <>
          {label}
          {!resolveEnabledState(mod) && (
            <OreTag variant="neutral" size="sm" weight="bold">
              {t('modSnapshots.tags.disabled', { defaultValue: 'Disabled' })}
            </OreTag>
          )}
        </>
      }
      metaItems={buildMetaItems(mod, t)}
    />
  );
};
