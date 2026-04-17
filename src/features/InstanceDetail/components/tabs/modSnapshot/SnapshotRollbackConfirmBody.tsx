import React from 'react';
import type { TFunction } from 'i18next';
import { RefreshCw } from 'lucide-react';
import type { SnapshotDiff } from '../../../logic/modService';
import { getDisplayFileName, getVersionLabel, resolveEnabledState } from './modSnapshotUtils';

export interface SnapshotRollbackConfirmBodyProps {
  rollbackTargetIndex: number;
  historyLength: number;
  rollbackDiff: SnapshotDiff | null;
  t: TFunction;
}

export const SnapshotRollbackConfirmBody: React.FC<SnapshotRollbackConfirmBodyProps> = ({
  rollbackTargetIndex,
  historyLength,
  rollbackDiff,
  t
}) => {
  if (rollbackTargetIndex < 0) return null;

  const targetLabel = getVersionLabel(t, rollbackTargetIndex, historyLength);

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
