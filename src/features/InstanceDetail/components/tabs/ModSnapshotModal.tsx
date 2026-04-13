import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import type { TFunction } from 'i18next';
import { AlertTriangle, GitCommit, Pin, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreTag } from '../../../../ui/primitives/OreTag';

import type { InstanceSnapshot, ModEntry, ModMeta, SnapshotDiff } from '../../logic/modService';

interface ModSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: InstanceSnapshot[];
  currentMods: ModMeta[];
  diffs: Record<string, SnapshotDiff>;
  onDiffRequest: (oldId: string, newId: string) => void;
  onRollback: (snapshotId: string) => void;
  isRollingBack: boolean;
}

type SnapshotModEntry = InstanceSnapshot['mods'][number];

const TIMELINE_ROW_FOCUS_KEY_PREFIX = 'mod-snapshot-timeline';
const ROLLBACK_FOCUS_KEY = 'mod-snapshot-rollback';

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'var(--ore-downloadDetail-surface)',
  borderColor: 'var(--ore-downloadDetail-divider)',
  boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
};

const insetStyle: React.CSSProperties = {
  backgroundColor: 'var(--ore-downloadDetail-base)',
  borderColor: 'var(--ore-downloadDetail-divider)',
  boxShadow: 'var(--ore-downloadDetail-sectionInset)'
};

const resolveEnabledState = (mod: SnapshotModEntry) => mod.isEnabled ?? !mod.fileName.endsWith('.disabled');

const getDisplayFileName = (mod: SnapshotModEntry) => mod.fileName.replace(/\.disabled$/i, '');

const getTimelineFocusKey = (snapshotId: string) => `${TIMELINE_ROW_FOCUS_KEY_PREFIX}-${snapshotId}`;

/**
 * Compute a client-side diff between the live mod list and a target snapshot.
 * This compares what is currently on disk vs what the snapshot recorded.
 */
const computeRollbackDiff = (liveMods: ModMeta[], targetMods: ModEntry[]): SnapshotDiff => {
  // Build maps keyed by normalised filename (without .disabled suffix)
  const normaliseName = (name: string) => name.replace(/\.disabled$/i, '');

  const liveByName = new Map<string, ModMeta>();
  for (const m of liveMods) {
    liveByName.set(normaliseName(m.fileName), m);
  }

  const targetByName = new Map<string, ModEntry>();
  for (const m of targetMods) {
    targetByName.set(normaliseName(m.fileName), m);
  }

  const added: ModEntry[] = [];      // in target but not in live → will be restored
  const removed: ModEntry[] = [];    // in live but not in target → will be removed
  const updated: { old: ModEntry; new: ModEntry }[] = [];       // same name, different hash
  const stateChanged: { old: ModEntry; new: ModEntry }[] = [];  // same file, different enabled state

  // Mods that exist in live but not in target → will be removed
  for (const [name, liveMod] of liveByName) {
    if (!targetByName.has(name)) {
      removed.push({
        hash: '',
        fileName: liveMod.fileName,
        modId: liveMod.modId,
        version: liveMod.version,
        isEnabled: liveMod.isEnabled
      });
    }
  }

  // Mods in target
  for (const [name, targetMod] of targetByName) {
    const liveMod = liveByName.get(name);
    if (!liveMod) {
      // In target but not in live → will be restored
      added.push(targetMod);
    } else {
      // Both exist — check for content changes or state changes
      const liveEnabled = liveMod.isEnabled;
      const targetEnabled = targetMod.isEnabled ?? !targetMod.fileName.endsWith('.disabled');

      // Compare by manifest hash if available
      const liveHash = liveMod.manifestEntry?.hash?.value || '';
      const targetHash = targetMod.hash || '';
      if (liveHash && targetHash && liveHash !== targetHash) {
        updated.push({
          old: {
            hash: liveHash,
            fileName: liveMod.fileName,
            modId: liveMod.modId,
            version: liveMod.version,
            isEnabled: liveEnabled
          },
          new: targetMod
        });
      } else if (liveEnabled !== targetEnabled) {
        stateChanged.push({
          old: {
            hash: liveHash,
            fileName: liveMod.fileName,
            modId: liveMod.modId,
            version: liveMod.version,
            isEnabled: liveEnabled
          },
          new: targetMod
        });
      }
    }
  }

  return { added, removed, updated, stateChanged };
};


/** Build a consistent version label: Snapshot #N (newest = highest number). */
const getVersionLabel = (t: TFunction, index: number, total: number) =>
  t('modSnapshots.timeline.snapshotLabel', {
    defaultValue: 'Snapshot #{{index}}',
    index: total - index
  });

export const ModSnapshotModal: React.FC<ModSnapshotModalProps> = ({
  isOpen,
  onClose,
  history,
  currentMods,
  diffs,
  onDiffRequest,
  onRollback,
  isRollingBack
}) => {
  const { t, i18n } = useTranslation();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [rollbackConfirmTarget, setRollbackConfirmTarget] = useState<string | null>(null);

  const timelineFocusKeys = useMemo(
    () => history.map((snapshot) => getTimelineFocusKey(snapshot.id)),
    [history]
  );

  const defaultFocusKey = selectedSnapshotId
    ? getTimelineFocusKey(selectedSnapshotId)
    : timelineFocusKeys[0];

  const { handleLinearArrow: handleTimelineLinearArrow } = useLinearNavigation(
    timelineFocusKeys,
    defaultFocusKey,
    false,
    isOpen
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedSnapshotId(null);
      setRollbackConfirmTarget(null);
      return;
    }

    if (history.length === 0) {
      setSelectedSnapshotId(null);
      return;
    }

    const hasSelectedSnapshot = history.some((snapshot) => snapshot.id === selectedSnapshotId);
    if (!hasSelectedSnapshot) {
      setSelectedSnapshotId(history[0].id);
    }
  }, [history, isOpen, selectedSnapshotId]);

  useEffect(() => {
    if (!selectedSnapshotId || history.length === 0) {
      return;
    }

    const currentIndex = history.findIndex((snapshot) => snapshot.id === selectedSnapshotId);
    if (currentIndex < 0 || currentIndex >= history.length - 1) {
      return;
    }

    const previousSnapshotId = history[currentIndex + 1].id;
    const diffKey = `${previousSnapshotId}->${selectedSnapshotId}`;
    if (!diffs[diffKey]) {
      onDiffRequest(previousSnapshotId, selectedSnapshotId);
    }
  }, [diffs, history, onDiffRequest, selectedSnapshotId]);

  // Client-side rollback diff: compare live mods against target snapshot
  const rollbackTargetIndex = rollbackConfirmTarget
    ? history.findIndex((s) => s.id === rollbackConfirmTarget)
    : -1;
  const rollbackTargetSnapshot = rollbackTargetIndex >= 0 ? history[rollbackTargetIndex] : null;
  const rollbackDiff = useMemo(() => {
    if (!rollbackTargetSnapshot || !rollbackConfirmTarget) return null;
    return computeRollbackDiff(currentMods, rollbackTargetSnapshot.mods);
  }, [currentMods, rollbackTargetSnapshot, rollbackConfirmTarget]);

  const handleRollbackClick = useCallback(() => {
    if (!selectedSnapshotId) return;
    setRollbackConfirmTarget(selectedSnapshotId);
  }, [selectedSnapshotId]);

  const handleRollbackConfirm = useCallback(() => {
    if (!rollbackConfirmTarget) return;
    onRollback(rollbackConfirmTarget);
    setRollbackConfirmTarget(null);
  }, [rollbackConfirmTarget, onRollback]);

  const handleRollbackCancel = useCallback(() => {
    setRollbackConfirmTarget(null);
  }, []);

  if (!isOpen) {
    return null;
  }

  const selectedSnapshot = history.find((snapshot) => snapshot.id === selectedSnapshotId);
  const currentIndex = selectedSnapshot
    ? history.findIndex((snapshot) => snapshot.id === selectedSnapshot.id)
    : -1;
  const previousSnapshot =
    currentIndex >= 0 && currentIndex < history.length - 1 ? history[currentIndex + 1] : null;
  const currentDiff = previousSnapshot ? diffs[`${previousSnapshot.id}->${selectedSnapshotId}`] : null;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(i18n.language || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

  const buildMetaItems = (mod: SnapshotModEntry): string[] => {
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

  const handleTimelineArrow = (snapshotId: string) => (direction: string) => {
    if (direction === 'up' || direction === 'down') {
      return handleTimelineLinearArrow(direction);
    }

    if (direction === 'right' && selectedSnapshot) {
      setSelectedSnapshotId(snapshotId);
      setFocus(ROLLBACK_FOCUS_KEY);
      return false;
    }

    return undefined;
  };

  const handleRollbackArrow = (direction: string) => {
    if (direction === 'left' && selectedSnapshotId) {
      setFocus(getTimelineFocusKey(selectedSnapshotId));
      return false;
    }

    return undefined;
  };

  const renderSnapshotRow = (
    mod: SnapshotModEntry,
    label: React.ReactNode,
    description?: React.ReactNode
  ) => (
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
      metaItems={buildMetaItems(mod)}
    />
  );

  const renderTimeline = () => {
    if (history.length === 0) {
      return (
        <div
          className="flex min-h-48 items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
          style={insetStyle}
        >
          {t('modSnapshots.empty', { defaultValue: 'No snapshot records yet.' })}
        </div>
      );
    }

    return (
      <div className="custom-scrollbar flex flex-col gap-2 overflow-y-auto px-1 pt-1 pr-2 pb-2">
        {history.map((snapshot, index) => {
          const isSelected = selectedSnapshotId === snapshot.id;
          const versionLabel = getVersionLabel(t, index, history.length);

          return (
            <OreAssetRow
              key={snapshot.id}
              focusKey={getTimelineFocusKey(snapshot.id)}
              onClick={() => setSelectedSnapshotId(snapshot.id)}
              onFocus={() => setSelectedSnapshotId(snapshot.id)}
              onEnter={() => setSelectedSnapshotId(snapshot.id)}
              onArrowPress={handleTimelineArrow(snapshot.id)}
              selected={isSelected}
              operationActive={isSelected}
              title={versionLabel}
              description={snapshot.message || t('modSnapshots.labels.noMessage', { defaultValue: 'No note provided' })}
              badges={
                index === 0 ? (
                  <OreTag variant="primary" size="sm" weight="bold">
                    <Pin size={12} className="mr-1 inline-block" />
                    {t('modSnapshots.tags.latest', { defaultValue: 'Latest' })}
                  </OreTag>
                ) : undefined
              }
              metaItems={[
                formatDate(snapshot.timestamp),
                t('modSnapshots.timeline.modCount', {
                  defaultValue: '{{count}} mods',
                  count: snapshot.mods.length
                })
              ]}
            />
          );
        })}
      </div>
    );
  };

  const renderDiffContent = () => {
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
          {selectedSnapshot.mods.map((mod) =>
            renderSnapshotRow(
              mod,
              <OreTag variant="neutral" size="sm" weight="bold">
                {t('modSnapshots.tags.initialState', { defaultValue: 'Initial State' })}
              </OreTag>,
              resolveEnabledState(mod)
                ? t('modSnapshots.descriptions.initialEnabled', {
                    defaultValue: 'This mod is first recorded in this snapshot.'
                  })
                : t('modSnapshots.descriptions.initialDisabled', {
                    defaultValue: 'This mod is first recorded in this snapshot and is disabled here.'
                  })
            )
          )}
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
          {currentDiff.added.map((mod) =>
            renderSnapshotRow(
              mod,
              <OreTag variant="primary" size="sm" weight="bold">
                {t('modSnapshots.tags.added', { defaultValue: 'Added' })}
              </OreTag>,
              t('modSnapshots.descriptions.added', {
                defaultValue: 'This mod first appears in the selected snapshot.'
              })
            )
          )}
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
          {currentDiff.removed.map((mod) =>
            renderSnapshotRow(
              mod,
              <OreTag variant="warning" size="sm" weight="bold">
                {t('modSnapshots.tags.removed', { defaultValue: 'Removed' })}
              </OreTag>,
              t('modSnapshots.descriptions.removed', {
                defaultValue: 'This mod exists in the previous snapshot but not in the selected snapshot.'
              })
            )
          )}
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

  /** Build the rollback confirmation dialog body. */
  const renderRollbackConfirmBody = () => {
    if (rollbackTargetIndex < 0) return null;

    const targetLabel = getVersionLabel(t, rollbackTargetIndex, history.length);

    // If it's the same as current, nothing to show
    if (!rollbackDiff) {
      return (
        <div className="mt-4 flex w-full items-center justify-center px-4 py-3 text-sm text-ore-text-muted">
          <RefreshCw className="mr-2 animate-spin" size={14} />
          {t('modSnapshots.rollbackConfirm.loading', {
            defaultValue: 'Calculating changes...'
          })}
        </div>
      );
    }

    const { added, removed, updated, stateChanged } = rollbackDiff;
    const hasNoChanges = added.length === 0 && removed.length === 0 && updated.length === 0 && stateChanged.length === 0;

    if (hasNoChanges) {
      return (
        <div className="mt-3 w-full rounded border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-ore-text-muted">
          {t('modSnapshots.rollbackConfirm.noChanges', {
            defaultValue: 'The current state is identical to {{target}}. No changes will be made.',
            target: targetLabel
          })}
        </div>
      );
    }

    return (
      <div className="mt-3 w-full space-y-2 text-left text-sm">
        {/* Note: In rollback context, the diff is computed as current→target.
            "added" means mods that exist in target but not in current → will be restored.
            "removed" means mods that exist in current but not in target → will be removed. */}
        {removed.length > 0 && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
            <div className="mb-1 font-minecraft text-red-300">
              {t('modSnapshots.rollbackConfirm.willRemove', {
                defaultValue: '🗑 Will remove {{count}} mod(s)',
                count: removed.length
              })}
            </div>
            <ul className="ml-4 list-disc text-xs text-red-200/80">
              {removed.slice(0, 8).map((mod) => (
                <li key={mod.hash}>{getDisplayFileName(mod)}</li>
              ))}
              {removed.length > 8 && (
                <li className="text-red-300/60">
                  {t('modSnapshots.rollbackConfirm.andMore', {
                    defaultValue: '...and {{count}} more',
                    count: removed.length - 8
                  })}
                </li>
              )}
            </ul>
          </div>
        )}

        {added.length > 0 && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <div className="mb-1 font-minecraft text-emerald-300">
              {t('modSnapshots.rollbackConfirm.willRestore', {
                defaultValue: '📦 Will restore {{count}} mod(s)',
                count: added.length
              })}
            </div>
            <ul className="ml-4 list-disc text-xs text-emerald-200/80">
              {added.slice(0, 8).map((mod) => (
                <li key={mod.hash}>{getDisplayFileName(mod)}</li>
              ))}
              {added.length > 8 && (
                <li className="text-emerald-300/60">
                  {t('modSnapshots.rollbackConfirm.andMore', {
                    defaultValue: '...and {{count}} more',
                    count: added.length - 8
                  })}
                </li>
              )}
            </ul>
          </div>
        )}

        {updated.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <div className="mb-1 font-minecraft text-amber-300">
              {t('modSnapshots.rollbackConfirm.willReplace', {
                defaultValue: '🔄 Will replace {{count}} mod(s)',
                count: updated.length
              })}
            </div>
            <ul className="ml-4 list-disc text-xs text-amber-200/80">
              {updated.slice(0, 8).map((pair) => (
                <li key={pair.new.hash}>{getDisplayFileName(pair.new)}</li>
              ))}
              {updated.length > 8 && (
                <li className="text-amber-300/60">
                  {t('modSnapshots.rollbackConfirm.andMore', {
                    defaultValue: '...and {{count}} more',
                    count: updated.length - 8
                  })}
                </li>
              )}
            </ul>
          </div>
        )}

        {stateChanged.length > 0 && (
          <div className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2">
            <div className="mb-1 font-minecraft text-sky-300">
              {t('modSnapshots.rollbackConfirm.willToggle', {
                defaultValue: '⚡ Will toggle {{count}} mod(s) enabled/disabled state',
                count: stateChanged.length
              })}
            </div>
            <ul className="ml-4 list-disc text-xs text-sky-200/80">
              {stateChanged.slice(0, 8).map((pair) => {
                const newState = resolveEnabledState(pair.new);
                return (
                  <li key={pair.new.hash}>
                    {getDisplayFileName(pair.new)} → {newState
                      ? t('modSnapshots.states.enabled', { defaultValue: 'Enabled' })
                      : t('modSnapshots.states.disabled', { defaultValue: 'Disabled' })}
                  </li>
                );
              })}
              {stateChanged.length > 8 && (
                <li className="text-sky-300/60">
                  {t('modSnapshots.rollbackConfirm.andMore', {
                    defaultValue: '...and {{count}} more',
                    count: stateChanged.length - 8
                  })}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <OreModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('modSnapshots.title', { defaultValue: 'Mod Snapshot Timeline' })}
        className="w-[min(96vw,72rem)] max-w-6xl"
        contentClassName="overflow-hidden p-5"
        defaultFocusKey={defaultFocusKey}
      >
        <div className="flex h-[72vh] flex-col gap-4 lg:flex-row">
          <section
            className="flex w-full flex-col border-[0.125rem] p-3 lg:basis-[22rem] lg:max-w-[24rem] xl:basis-[24rem] xl:max-w-[28rem]"
            style={sectionStyle}
          >
            <div className="mb-3 flex items-center gap-2 px-1 text-[var(--ore-downloadDetail-labelText)]">
              <GitCommit size={18} />
              <h3 className="font-minecraft text-lg">
                {t('modSnapshots.timeline.title', { defaultValue: 'Version History' })}
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {renderTimeline()}
            </div>
          </section>

          <section className="flex min-w-0 flex-1 flex-col gap-4">
            {selectedSnapshot ? (
              <>
                <div className="border-[0.125rem] p-4" style={sectionStyle}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <OreTag variant="neutral" size="sm" weight="bold">
                          {getVersionLabel(t, currentIndex, history.length)}
                        </OreTag>
                        {currentIndex === 0 && (
                          <OreTag variant="primary" size="sm" weight="bold">
                            <Pin size={12} className="mr-1 inline-block" />
                            {t('modSnapshots.tags.latest', { defaultValue: 'Latest' })}
                          </OreTag>
                        )}
                        <OreTag variant="neutral" size="sm">
                          {t('modSnapshots.timeline.modCount', {
                            defaultValue: '{{count}} mods',
                            count: selectedSnapshot.mods.length
                          })}
                        </OreTag>
                      </div>
                      <h2 className="break-all font-minecraft text-2xl text-[var(--ore-modal-content-text)] ore-text-shadow">
                        {selectedSnapshot.message || t('modSnapshots.labels.untitled', { defaultValue: 'Snapshot State' })}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--ore-downloadDetail-mutedText)]">
                        {t('modSnapshots.labels.createdAt', {
                          defaultValue: 'Created At: {{value}}',
                          value: formatDate(selectedSnapshot.timestamp)
                        })}
                      </p>
                    </div>

                    <OreButton
                      focusKey={ROLLBACK_FOCUS_KEY}
                      variant="hero"
                      size="auto"
                      disabled={isRollingBack}
                      onClick={handleRollbackClick}
                      onArrowPress={handleRollbackArrow}
                      className="!h-12 !min-h-12 self-start"
                    >
                      {isRollingBack ? (
                        <RefreshCw className="mr-2 animate-spin" size={18} />
                      ) : (
                        <RefreshCw className="mr-2" size={18} />
                      )}
                      {isRollingBack
                        ? t('modSnapshots.actions.rollingBack', { defaultValue: 'Rolling Back...' })
                        : t('modSnapshots.actions.rollback', { defaultValue: 'Rollback to This Snapshot' })}
                    </OreButton>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                  <div
                    className="border-[0.125rem] px-4 py-3 text-sm text-[var(--ore-downloadDetail-labelText)]"
                    style={insetStyle}
                  >
                    {previousSnapshot
                      ? t('modSnapshots.summary.compareWithPrevious', {
                          defaultValue: 'Comparing the selected snapshot with the previous version.'
                        })
                      : t('modSnapshots.summary.initialSnapshot', {
                          defaultValue: 'This is the earliest snapshot in history. The list below shows the recorded mod state.'
                        })}
                  </div>

                  <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pt-1 pr-2 pb-2">
                    {renderDiffContent()}
                  </div>
                </div>
              </>
            ) : (
              <div
                className="flex min-h-full items-center justify-center border-[0.125rem] px-6 py-10 text-center text-sm text-[var(--ore-downloadDetail-mutedText)]"
                style={insetStyle}
              >
                {t('modSnapshots.emptySelection', { defaultValue: 'Select a snapshot from the left first.' })}
              </div>
            )}
          </section>
        </div>
      </OreModal>

      <OreConfirmDialog
        isOpen={rollbackConfirmTarget !== null}
        onClose={handleRollbackCancel}
        onConfirm={handleRollbackConfirm}
        title={t('modSnapshots.rollbackConfirm.title', { defaultValue: 'Confirm Rollback' })}
        headline={
          rollbackTargetIndex >= 0
            ? t('modSnapshots.rollbackConfirm.headline', {
                defaultValue: 'Rollback to {{target}}?',
                target: getVersionLabel(t, rollbackTargetIndex, history.length)
              })
            : undefined
        }
        description={t('modSnapshots.rollbackConfirm.description', {
          defaultValue: 'This will replace your current mod files with the state from the selected snapshot. A backup snapshot of the current state will be created automatically before rollback.'
        })}
        confirmLabel={t('modSnapshots.rollbackConfirm.confirm', { defaultValue: 'Confirm Rollback' })}
        cancelLabel={t('modSnapshots.rollbackConfirm.cancel', { defaultValue: 'Cancel' })}
        confirmVariant="hero"
        tone="warning"
        confirmFocusKey="mod-snapshot-rollback-confirm"
        cancelFocusKey="mod-snapshot-rollback-cancel"
        dialogIcon={<AlertTriangle size={24} className="text-yellow-400" />}
        confirmIcon={<RefreshCw size={16} className="mr-2" />}
        isConfirming={isRollingBack}
        className="w-full max-w-lg"
        bodyClassName="flex flex-col items-center justify-center py-4 text-center"
      >
        {renderRollbackConfirmBody()}
      </OreConfirmDialog>
    </>
  );
};
