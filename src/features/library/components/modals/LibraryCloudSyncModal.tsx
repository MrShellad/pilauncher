import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  FileDown,
  FileUp,
  History,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { LibraryWebDavSyncRecord } from '../../hooks/useLibraryBackup';

interface LibraryCloudSyncModalProps {
  isOpen: boolean;
  isBusy: boolean;
  isSyncingWebDav: boolean;
  records: LibraryWebDavSyncRecord[];
  onClose: () => void;
  onExportLibrary: () => void;
  onImportLibrary: () => void;
  onSyncWebDav: () => void;
}

const formatSyncTime = (value: number) => (
  Number.isFinite(value) && value > 0 ? new Date(value).toLocaleString() : '-'
);

export const LibraryCloudSyncModal: React.FC<LibraryCloudSyncModalProps> = ({
  isOpen,
  isBusy,
  isSyncingWebDav,
  records,
  onClose,
  onExportLibrary,
  onImportLibrary,
  onSyncWebDav,
}) => {
  const { t } = useTranslation();

  return (
  <OreModal
    isOpen={isOpen}
    onClose={onClose}
    title={t('libraryPage.cloud.title')}
    defaultFocusKey="library-cloud-export"
    className="w-[52rem] max-w-[calc(100vw-2rem)]"
    contentClassName="p-0 overflow-hidden"
  >
    <div className="grid min-h-[26rem] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="grid content-start gap-3 border-b-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-4 lg:border-b-0 lg:border-r-2">
        <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] p-3">
          <div className="flex items-center gap-2 font-minecraft text-base text-white">
            <Cloud size={16} className="text-[var(--ore-color-text-success-default)]" />
            {t('libraryPage.cloud.operations')}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--ore-color-text-muted-soft)]">
            {t('libraryPage.cloud.description')}
          </div>
        </div>

        <OreButton
          variant="secondary"
          focusKey="library-cloud-export"
          onClick={onExportLibrary}
          disabled={isBusy || isSyncingWebDav}
          className="w-full justify-center"
        >
          <span className="flex items-center justify-center gap-2 whitespace-nowrap font-minecraft text-sm">
            <FileDown size={18} />
            {t('libraryPage.cloud.export')}
          </span>
        </OreButton>

        <OreButton
          variant="secondary"
          focusKey="library-cloud-import"
          onClick={onImportLibrary}
          disabled={isBusy || isSyncingWebDav}
          className="w-full justify-center"
        >
          <span className="flex items-center justify-center gap-2 whitespace-nowrap font-minecraft text-sm">
            <FileUp size={18} />
            {t('libraryPage.cloud.import')}
          </span>
        </OreButton>

        <OreButton
          variant="primary"
          focusKey="library-cloud-sync"
          onClick={onSyncWebDav}
          disabled={isBusy || isSyncingWebDav}
          className="w-full justify-center"
        >
          <span className="flex items-center justify-center gap-2 whitespace-nowrap font-minecraft text-sm">
            <RefreshCw size={18} className={isSyncingWebDav ? 'animate-spin' : ''} />
            {isSyncingWebDav ? t('libraryPage.cloud.syncing') : t('libraryPage.cloud.syncNow')}
          </span>
        </OreButton>
      </section>

      <aside className="flex min-w-0 flex-col bg-[var(--ore-color-background-surface-base)]">
        <div className="flex items-center gap-2 border-b-2 border-[var(--ore-color-border-primary-default)] px-4 py-3">
          <History size={16} className="text-[var(--ore-color-text-success-default)]" />
          <div className="font-minecraft text-sm text-white">{t('libraryPage.cloud.history')}</div>
          <div className="ml-auto text-xs text-[var(--ore-color-text-muted-soft)]">{t('libraryPage.cloud.recentCount', { count: records.length })}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          {records.length === 0 ? (
            <div className="flex h-full min-h-[16rem] items-center justify-center border-2 border-dashed border-[var(--ore-color-border-neutral-muted)] bg-[var(--ore-color-background-surface-panel)] px-4 text-center text-sm leading-6 text-[var(--ore-color-text-muted-dim)]">
              {t('libraryPage.cloud.emptyHistory')}
            </div>
          ) : (
            <div className="grid gap-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className={[
                    'border-2 p-3',
                    record.status === 'success'
                      ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-muted)]'
                      : 'border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)]',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {record.status === 'success' ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ore-color-text-success-default)]" />
                    ) : (
                      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--ore-color-text-danger-soft)]" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="font-minecraft text-sm text-white">
                          {record.status === 'success' ? t('libraryPage.cloud.success') : t('libraryPage.cloud.failed')}
                        </div>
                        <div className="text-xs text-[var(--ore-color-text-muted-soft)]">
                          {formatSyncTime(record.createdAt)}
                        </div>
                      </div>

                      {record.status === 'success' && record.result ? (
                        <div className="mt-2 grid gap-1 text-xs leading-5 text-[var(--ore-color-text-secondary-soft)]">
                          <div>
                            {t('libraryPage.cloud.resultLine1', {
                              uploaded: record.result.uploadedOperations,
                              downloaded: record.result.downloadedOperations,
                              favorites: record.result.mergedFavorites,
                            })}
                          </div>
                          <div>
                            {t('libraryPage.cloud.resultLine2', {
                              total: record.result.totalOperations,
                              snapshot: record.result.snapshotUpdated
                                ? t('libraryPage.cloud.snapshotUpdated')
                                : t('libraryPage.cloud.snapshotUnchanged'),
                            })}
                            {record.result.compactedOperations > 0
                              ? t('libraryPage.cloud.compacted', { count: record.result.compactedOperations })
                              : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 break-words text-xs leading-5 text-[var(--ore-color-text-danger-soft)]">
                          {record.error || t('libraryPage.cloud.unknownError')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  </OreModal>
  );
};
