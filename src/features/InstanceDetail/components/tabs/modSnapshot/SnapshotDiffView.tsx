import React from 'react';
import type { TFunction } from 'i18next';
import { RefreshCw } from 'lucide-react';
import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { InstanceSnapshot, SnapshotDiff } from '../../../../logic/modService';
import { SnapshotAssetRow } from './SnapshotAssetRow';
import { getDisplayFileName, resolveEnabledState } from './modSnapshotUtils';

const insetStyle: React.CSSProperties = {
  backgroundColor: 'var(--ore-downloadDetail-base)',
  borderColor: 'var(--ore-downloadDetail-divider)',
  boxShadow: 'var(--ore-downloadDetail-sectionInset)'
};

export interface SnapshotDiffViewProps {
  selectedSnapshot: InstanceSnapshot | null;
  previousSnapshot: InstanceSnapshot | null;
  currentDiff: SnapshotDiff | null;
  t: TFunction;
}

export const SnapshotDiffView: React.FC<SnapshotDiffViewProps> = ({
  selectedSnapshot,
  previousSnapshot,
  currentDiff,
  t
}) => {
  if (!selectedSnapshot) {
    return (
      <div
        className="flex min-h-48 items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
        style={insetStyle}
      >
        {t('modSnapshots.emptySelection', { defaultValue: 'Select a snapshot from the left first.' })}
      </div>
    );
  }

  if (!previousSnapshot) {
    return (
      <div className="flex flex-col gap-2">
        {selectedSnapshot.mods.map((mod) => (
          <SnapshotAssetRow
            key={`${mod.hash}-${mod.fileName}`}
            mod={mod}
            t={t}
            label={
              <OreTag variant="neutral" size="sm" weight="bold">
                {t('modSnapshots.tags.initialState', { defaultValue: 'Initial State' })}
              </OreTag>
            }
            description={
              resolveEnabledState(mod)
                ? t('modSnapshots.descriptions.initialEnabled', {
                    defaultValue: 'This mod is first recorded in this snapshot.'
                  })
                : t('modSnapshots.descriptions.initialDisabled', {
                    defaultValue: 'This mod is first recorded in this snapshot and is disabled here.'
                  })
            }
          />
        ))}
      </div>
    );
  }

  if (!currentDiff) {
    return (
      <div
        className="flex min-h-48 items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
        style={insetStyle}
      >
        <RefreshCw className="mr-2 animate-spin" size={18} />
        {t('modSnapshots.loadingDiff', {
          defaultValue: 'Calculating differences from the previous snapshot...'
        })}
      </div>
    );
  }

  const sections: React.ReactNode[] = [];

  if (currentDiff.added.length > 0) {
    sections.push(
      <React.Fragment key="added">
        <div className="mb-2 mt-1 flex items-center gap-2">
          <OreTag variant="primary" size="sm" weight="bold">
            {t('modSnapshots.tags.added', { defaultValue: 'Added' })}
          </OreTag>
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">
            {t('modSnapshots.sections.added', {
              defaultValue: 'Added {{count}} mods',
              count: currentDiff.added.length
            })}
          </span>
        </div>
        {currentDiff.added.map((mod) => (
          <SnapshotAssetRow
            key={`${mod.hash}-${mod.fileName}`}
            mod={mod}
            t={t}
            label={
              <OreTag variant="primary" size="sm" weight="bold">
                {t('modSnapshots.tags.added', { defaultValue: 'Added' })}
              </OreTag>
            }
            description={t('modSnapshots.descriptions.added', {
              defaultValue: 'This mod first appears in the selected snapshot.'
            })}
          />
        ))}
      </React.Fragment>
    );
  }

  if (currentDiff.removed.length > 0) {
    sections.push(
      <React.Fragment key="removed">
        <div className="mb-2 mt-1 flex items-center gap-2">
          <OreTag variant="warning" size="sm" weight="bold">
            {t('modSnapshots.tags.removed', { defaultValue: 'Removed' })}
          </OreTag>
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">
            {t('modSnapshots.sections.removed', {
              defaultValue: 'Removed {{count}} mods',
              count: currentDiff.removed.length
            })}
          </span>
        </div>
        {currentDiff.removed.map((mod) => (
          <SnapshotAssetRow
            key={`${mod.hash}-${mod.fileName}`}
            mod={mod}
            t={t}
            label={
              <OreTag variant="warning" size="sm" weight="bold">
                {t('modSnapshots.tags.removed', { defaultValue: 'Removed' })}
              </OreTag>
            }
            description={t('modSnapshots.descriptions.removed', {
              defaultValue: 'This mod exists in the previous snapshot but not in the selected snapshot.'
            })}
          />
        ))}
      </React.Fragment>
    );
  }

  if (currentDiff.updated.length > 0) {
    sections.push(
      <React.Fragment key="updated">
        <div className="mb-2 mt-1 flex items-center gap-2">
          <OreTag variant="notice" size="sm" weight="bold">
            {t('modSnapshots.tags.updated', { defaultValue: 'Updated' })}
          </OreTag>
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">
            {t('modSnapshots.sections.updated', {
              defaultValue: 'Updated {{count}} mods',
              count: currentDiff.updated.length
            })}
          </span>
        </div>
        {currentDiff.updated.map((pair, index) => (
          <OreAssetRow
            key={`updated-${pair.old.hash}-${pair.new.hash}-${index}`}
            focusable={false}
            title={getDisplayFileName(pair.new)}
            description={t('modSnapshots.descriptions.updated', {
              defaultValue: 'The file content of this mod changed.'
            })}
            badges={
              <OreTag variant="notice" size="sm" weight="bold">
                {t('modSnapshots.tags.contentUpdated', { defaultValue: 'Content Updated' })}
              </OreTag>
            }
            metaItems={[
              t('modSnapshots.meta.oldFile', {
                defaultValue: 'Old File: {{fileName}}',
                fileName: pair.old.fileName
              }),
              t('modSnapshots.meta.newFile', {
                defaultValue: 'New File: {{fileName}}',
                fileName: pair.new.fileName
              }),
              t('modSnapshots.meta.oldSha1', {
                defaultValue: 'Old SHA1: {{hash}}',
                hash: pair.old.hash.slice(0, 10)
              }),
              t('modSnapshots.meta.newSha1', {
                defaultValue: 'New SHA1: {{hash}}',
                hash: pair.new.hash.slice(0, 10)
              })
            ]}
          />
        ))}
      </React.Fragment>
    );
  }

  if (currentDiff.stateChanged.length > 0) {
    sections.push(
      <React.Fragment key="state-changed">
        <div className="mb-2 mt-1 flex items-center gap-2">
          <OreTag variant="informative" size="sm" weight="bold">
            {t('modSnapshots.tags.stateChanged', { defaultValue: 'State Changed' })}
          </OreTag>
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">
            {t('modSnapshots.sections.stateChanged', {
              defaultValue: 'Changed enabled state for {{count}} mods',
              count: currentDiff.stateChanged.length
            })}
          </span>
        </div>
        {currentDiff.stateChanged.map((pair, index) => {
          const oldState = resolveEnabledState(pair.old);
          const newState = resolveEnabledState(pair.new);

          return (
            <OreAssetRow
              key={`state-${pair.old.hash}-${pair.new.hash}-${index}`}
              focusable={false}
              title={getDisplayFileName(pair.new)}
              description={t('modSnapshots.descriptions.stateChanged', {
                defaultValue: '{{from}} -> {{to}}',
                from: oldState
                  ? t('modSnapshots.states.enabled', { defaultValue: 'Enabled' })
                  : t('modSnapshots.states.disabled', { defaultValue: 'Disabled' }),
                to: newState
                  ? t('modSnapshots.states.enabled', { defaultValue: 'Enabled' })
                  : t('modSnapshots.states.disabled', { defaultValue: 'Disabled' })
              })}
              badges={
                <OreTag variant={newState ? 'primary' : 'neutral'} size="sm" weight="bold">
                  {newState
                    ? t('modSnapshots.tags.enabled', { defaultValue: 'Enabled' })
                    : t('modSnapshots.tags.disabled', { defaultValue: 'Disabled' })}
                </OreTag>
              }
              metaItems={[
                t('modSnapshots.meta.oldFile', {
                  defaultValue: 'Old File: {{fileName}}',
                  fileName: pair.old.fileName
                }),
                t('modSnapshots.meta.newFile', {
                  defaultValue: 'New File: {{fileName}}',
                  fileName: pair.new.fileName
                })
              ]}
            />
          );
        })}
      </React.Fragment>
    );
  }

  if (sections.length === 0) {
    return (
      <div
        className="flex min-h-48 items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
        style={insetStyle}
      >
        {t('modSnapshots.noChanges', {
          defaultValue: 'No file-level changes compared with the previous snapshot.'
        })}
      </div>
    );
  }

  return <div className="flex flex-col gap-2">{sections}</div>;
};
