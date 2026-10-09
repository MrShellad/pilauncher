import React from 'react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import type { LibraryImportDraft } from '../../logic/libraryBackup';

interface LibraryImportPreviewModalProps {
  draft: LibraryImportDraft | null;
  isBusy: boolean;
  errorMessage: string;
  onClose: () => void;
  onToggleMergeTags: () => void;
  onConfirm: () => void;
}

export const LibraryImportPreviewModal: React.FC<LibraryImportPreviewModalProps> = ({
  draft,
  isBusy,
  errorMessage,
  onClose,
  onToggleMergeTags,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
  <OreModal
    isOpen={!!draft}
    onClose={onClose}
    title={t('libraryPage.importPreview.title')}
    className="w-[38rem] max-w-[calc(100vw-2rem)]"
    actionsClassName="!justify-center"
    actions={(
      <>
        <OreButton variant="secondary" disabled={isBusy} onClick={onClose}>
          {t('common.cancel')}
        </OreButton>
        <OreButton variant="primary" disabled={!draft || isBusy} onClick={onConfirm}>
          {t('libraryPage.importPreview.confirm')}
        </OreButton>
      </>
    )}
  >
    {draft && (
      <div className="grid gap-4">
        <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-3 py-2 text-sm text-[var(--ore-color-text-secondary-default)]">
          <div className="truncate font-minecraft text-white">{draft.path}</div>
          <div className="mt-1 text-xs text-[var(--ore-color-text-muted-soft)]">{t('libraryPage.importPreview.description')}</div>
        </div>

        <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] p-3">
          <OreSwitch
            checked={draft.options.mergeSameNameTags}
            disabled={isBusy}
            label={t('libraryPage.importPreview.mergeTags')}
            focusKey="library-import-merge-tags"
            onChange={onToggleMergeTags}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [t('libraryPage.importPreview.starredItems'), t('libraryPage.importPreview.newDuplicate', { added: draft.preview.newStarredItems, duplicate: draft.preview.duplicateStarredItems })],
            [t('libraryPage.importPreview.collections'), t('libraryPage.importPreview.newMerged', { added: draft.preview.newCollections, merged: draft.preview.mergedTagCollections })],
            [t('libraryPage.importPreview.relations'), t('libraryPage.importPreview.newDuplicate', { added: draft.preview.newCollectionItems, duplicate: draft.preview.duplicateCollectionItems })],
            [t('libraryPage.importPreview.trackers'), t('libraryPage.importPreview.importableTotal', { importable: draft.preview.importableModSetTrackers, total: draft.preview.modSetTrackers })],
          ].map(([label, value]) => (
            <div key={label} className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-3 py-2">
              <div className="font-minecraft text-xs text-[var(--ore-color-text-success-soft)]">{label}</div>
              <div className="mt-1 font-minecraft text-sm text-white">{value}</div>
            </div>
          ))}
        </div>

        {draft.preview.warnings.length > 0 && (
          <div className="max-h-32 overflow-y-auto border-2 border-[var(--ore-library-importPreview-warningBorder)] bg-[var(--ore-library-importPreview-warningBg)] p-3 text-xs leading-5 text-[var(--ore-library-importPreview-warningText)] custom-scrollbar">
            {draft.preview.warnings.slice(0, 8).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="border-2 border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)] px-3 py-2 text-sm text-[var(--ore-color-text-danger-soft)]">
            {errorMessage}
          </div>
        )}
      </div>
    )}
  </OreModal>
  );
};
