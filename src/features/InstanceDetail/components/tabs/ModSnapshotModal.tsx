import React from 'react';

import { AlertTriangle, GitCommit, Pin, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreTag } from '../../../../ui/primitives/OreTag';

import type { InstanceSnapshot, ModMeta, SnapshotDiff } from '../../logic/modService';
import { getVersionLabel } from './modSnapshot/modSnapshotUtils';
import { SnapshotDiffView } from './modSnapshot/SnapshotDiffView';
import { SnapshotRollbackConfirmBody } from './modSnapshot/SnapshotRollbackConfirmBody';
import { SnapshotTimelineList } from './modSnapshot/SnapshotTimelineList';
import { ROLLBACK_FOCUS_KEY, useModSnapshot } from './modSnapshot/useModSnapshot';

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

  const {
    rollbackConfirmTarget,
    rollbackDiff,
    rollbackTargetIndex,
    selectedSnapshot,
    currentIndex,
    previousSnapshot,
    currentDiff,
    defaultFocusKey,
    selectedSnapshotId,
    setSelectedSnapshotId,
    handleRollbackClick,
    handleRollbackConfirm,
    handleRollbackCancel,
    handleTimelineArrow,
    handleRollbackArrow
  } = useModSnapshot({
    isOpen,
    history,
    currentMods,
    diffs,
    onDiffRequest,
    onRollback
  });

  if (!isOpen) {
    return null;
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(i18n.language || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

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
              <SnapshotTimelineList
                history={history}
                selectedSnapshotId={selectedSnapshotId}
                t={t}
                formatDate={formatDate}
                onSelect={setSelectedSnapshotId}
                onArrowPress={handleTimelineArrow}
              />
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
                    <SnapshotDiffView
                      selectedSnapshot={selectedSnapshot}
                      previousSnapshot={previousSnapshot}
                      currentDiff={currentDiff}
                      t={t}
                    />
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
        <SnapshotRollbackConfirmBody
          rollbackTargetIndex={rollbackTargetIndex}
          historyLength={history.length}
          rollbackDiff={rollbackDiff}
          t={t}
        />
      </OreConfirmDialog>
    </>
  );
};
