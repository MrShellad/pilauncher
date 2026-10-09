import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../../ui/i18';
import { CloudCog, HardDrive, RefreshCw, Save, Shirt, Star } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreSwitch } from '../../../../../../ui/primitives/OreSwitch';
import { OreOverlayScrollArea } from '../../../../../../ui/primitives/OreOverlayScrollArea';
import type { WebDavSettings } from '../../../../../../types/settings';
import type { WebDavSyncResult } from '../types';

interface WebDavSettingsModalProps {
  isOpen: boolean;
  draft: WebDavSettings;
  isSyncing: boolean;
  syncResult: WebDavSyncResult | null;
  error: string;
  onClose: () => void;
  onChange: (patch: Partial<WebDavSettings>) => void;
  onSave: () => void;
  onSync: () => Promise<void>;
}

const getEndpointHint = (address: string) => {
  try {
    const parsed = new URL(address.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return i18n.t('settings.data.webdav.addressProtocolError');
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return i18n.t('settings.data.webdav.defaultPort', { protocol: parsed.protocol === 'https:' ? 'HTTPS' : 'HTTP', port });
  } catch {
    return i18n.t('settings.data.webdav.addressProtocolError');
  }
};

export const WebDavSettingsModal: React.FC<WebDavSettingsModalProps> = ({
  isOpen,
  draft,
  isSyncing,
  syncResult,
  error,
  onClose,
  onChange,
  onSave,
  onSync,
}) => {
  const { t } = useTranslation();
  const endpointHint = useMemo(() => getEndpointHint(draft.address), [draft.address]);
  const canSync = draft.address.trim() !== '' && (draft.syncFavorites || draft.syncSkinAssets || draft.syncSaveBackups) && !isSyncing;


  const saveBackupModeOptions = useMemo(
    () => [
      { label: t('settings.data.webdav.saveBackupModeBackup'), value: 'backup' },
      { label: t('settings.data.webdav.saveBackupModeSync'), value: 'sync' },
    ],
    [t]
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.webdav.title')}
      defaultFocusKey="webdav-address"
      className="w-[52rem] max-w-[calc(100vw-2rem)]"
      contentClassName="flex flex-col h-[35rem] overflow-hidden !p-0"
      actions={(
        <div className="flex w-full justify-center gap-3">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
            focusKey="webdav-cancel"
            disabled={isSyncing}
            className="flex-1"
          >
            {t('settings.data.webdav.close')}
          </OreButton>
          <OreButton
            variant="secondary"
            size="full"
            onClick={onSave}
            focusKey="webdav-save"
            disabled={isSyncing}
            className="flex-1"
          >
            <Save size={16} className="mr-1.5" />
            {t('settings.data.webdav.save')}
          </OreButton>
          <OreButton
            variant="primary"
            size="full"
            onClick={() => { void onSync(); }}
            focusKey="webdav-sync"
            disabled={!canSync}
            className="flex-1"
          >
            <RefreshCw size={16} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('settings.data.webdav.syncing') : t('settings.data.webdav.syncNow')}
          </OreButton>
        </div>
      )}
    >
      <div className="flex-1 min-h-0 grid grid-cols-[42%_1fr] overflow-hidden">
        {/* Left Column - Fixed inputs */}
        <section className="flex flex-col gap-4 p-6 border-r-2 border-[#1E1E1F]">
          <div className="border-2 border-[#1E1E1F] bg-[#242526] p-3 text-sm leading-6 text-[#D0D1D4]">
            <div className="flex items-center gap-2 font-minecraft text-base text-white">
              <CloudCog size={16} className="text-[#6CC349]" />
              {t('settings.data.webdav.connectionTitle')}
            </div>
            <div className="mt-1 text-xs text-[#B1B2B5]">
              {t('settings.data.webdav.connectionDesc')}
            </div>
          </div>

          <OreInput
            label={t('settings.data.webdav.address')}
            value={draft.address}
            onChange={(event) => onChange({ address: event.target.value })}
            placeholder="https://dav.example.com/remote.php/dav/files/user/PiLauncher"
            description={endpointHint}
            focusKey="webdav-address"
          />
          <OreInput
            label={t('settings.data.webdav.username')}
            value={draft.username}
            onChange={(event) => onChange({ username: event.target.value })}
            placeholder={t('settings.data.webdav.usernamePlaceholder')}
            focusKey="webdav-username"
          />
          <OreInput
            label={t('settings.data.webdav.password')}
            type="password"
            value={draft.password}
            onChange={(event) => onChange({ password: event.target.value })}
            placeholder={t('settings.data.webdav.passwordPlaceholder')}
            focusKey="webdav-password"
          />
        </section>

        {/* Right Column - Scrollable settings */}
        <OreOverlayScrollArea className="min-h-0" viewportClassName="p-6" contentSafePaddingRight={6}>
          <aside className="flex flex-col gap-4">
              <div className="border-2 border-[#1E1E1F] bg-[#242526] p-3 text-sm leading-6 text-[#D0D1D4]">
                <div className="flex items-center gap-2 font-minecraft text-base text-white">
                  <CloudCog size={16} className="text-[#6CC349]" />
                  {t('settings.data.webdav.backupItems')}
                </div>
                <div className="mt-1 text-xs text-[#B1B2B5]">
                  {t('settings.data.webdav.backupDesc')}
                </div>
              </div>

              <div className="flex min-h-[8.75rem] flex-col justify-between border-2 border-[#1E1E1F] bg-[#242526] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 font-minecraft text-sm text-white">
                    <Star size={15} className="text-[#F5C84B]" />
                    {t('settings.data.webdav.libraryFavorites')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#B1B2B5]">
                    {t('settings.data.webdav.remoteDirPrefix')} <span className="font-mono">PiLauncherSync/favorites/operations</span>.
                    {t('settings.data.webdav.operationDesc')}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-[#D0D1D4]">{t('settings.data.webdav.enableSync')}</span>
                  <OreSwitch
                    checked={draft.syncFavorites}
                    onChange={(value) => onChange({ syncFavorites: value })}
                    focusKey="webdav-sync-favorites"
                  />
                </div>
              </div>

              <div className="flex min-h-[8.75rem] flex-col justify-between border-2 border-[#1E1E1F] bg-[#242526] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 font-minecraft text-sm text-white">
                    <Shirt size={15} className="text-[#6CC349]" />
                    {t('settings.data.webdav.skinAssets')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#B1B2B5]">
                    {t('settings.data.webdav.remoteDirPrefix')} <span className="font-mono">PiLauncherSync/wardrobe/skins</span>.
                    {t('settings.data.webdav.skinBackupDesc')}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-[#D0D1D4]">{t('settings.data.webdav.enableSync')}</span>
                  <OreSwitch
                    checked={draft.syncSkinAssets}
                    onChange={(value) => onChange({ syncSkinAssets: value })}
                    focusKey="webdav-sync-skins"
                  />
                </div>
              </div>

              <div className="flex min-h-[8.75rem] flex-col justify-between border-2 border-[#1E1E1F] bg-[#242526] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 font-minecraft text-sm text-white">
                    <HardDrive size={15} className="text-[#5DADEC]" />
                    {t('settings.data.webdav.saveBackups')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#B1B2B5]">
                    {t('settings.data.webdav.remoteDirPrefix')} <span className="font-mono">PiLauncherSync/save-backups</span>.
                    {t('settings.data.webdav.saveBackupDesc')}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-[#D0D1D4]">{t('settings.data.webdav.enableSync')}</span>
                  <OreSwitch
                    checked={draft.syncSaveBackups}
                    onChange={(value) => onChange({ syncSaveBackups: value })}
                    focusKey="webdav-sync-save-backups"
                  />
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="mb-1.5 text-xs text-[#D0D1D4]">{t('settings.data.webdav.saveBackupMode')}</div>
                  <OreDropdown
                    options={saveBackupModeOptions}
                    value={draft.saveBackupMode || 'backup'}
                    onChange={(value) => onChange({ saveBackupMode: value as WebDavSettings['saveBackupMode'] })}
                    className="w-full"
                    focusKey="webdav-save-backup-mode"
                    portal
                    panelWidth="trigger"
                  />
                  <div className="mt-1.5 text-[11px] leading-4 text-[#B1B2B5]">
                    {draft.saveBackupMode === 'sync'
                      ? t('settings.data.webdav.saveBackupModeSyncDesc')
                      : t('settings.data.webdav.saveBackupModeBackupDesc')}
                  </div>
                </div>
              </div>
            </aside>
          </OreOverlayScrollArea>
      </div>

      {(error || syncResult) && (
        <div className="flex-shrink-0 border-t-2 border-[#1E1E1F] bg-[#141517] p-4 max-h-[8rem] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="border-2 border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {syncResult && (
            <div className="border-2 border-[#1D4D13] bg-[#1C2A1B] px-3 py-2 text-sm leading-6 text-[#A7F08A]">
              {syncResult.favorites && (
                <div>
                  {t('settings.data.webdav.favoriteResult', {
                    uploaded: syncResult.favorites.uploadedOperations,
                    downloaded: syncResult.favorites.downloadedOperations,
                    total: syncResult.favorites.totalOperations,
                    favorites: syncResult.favorites.mergedFavorites,
                    snapshot: syncResult.favorites.snapshotUpdated
                      ? t('settings.data.webdav.snapshotUpdated')
                      : t('settings.data.webdav.snapshotUnchanged'),
                    compacted: syncResult.favorites.compactedOperations,
                  })}
                </div>
              )}
              {syncResult.skins && (
                <div>
                  {t('settings.data.webdav.skinResult', {
                    uploaded: syncResult.skins.uploadedFiles,
                    downloaded: syncResult.skins.downloadedFiles,
                    local: syncResult.skins.localFiles,
                    remote: syncResult.skins.remoteFiles,
                    action: syncResult.skins.restored
                      ? t('settings.data.webdav.skinRestored')
                      : syncResult.skins.archiveUpdated
                        ? t('settings.data.webdav.skinUploaded')
                        : t('settings.data.webdav.skinUnchanged'),
                  })}
                </div>
              )}
              {syncResult.saveBackups && (
                <div>
                  {t('settings.data.webdav.saveBackupResult', {
                    uploaded: syncResult.saveBackups.uploadedFiles,
                    downloaded: syncResult.saveBackups.downloadedFiles,
                    local: syncResult.saveBackups.localFiles,
                    remote: syncResult.saveBackups.remoteFiles,
                    localBackups: syncResult.saveBackups.localBackups,
                    remoteBackups: syncResult.saveBackups.remoteBackups,
                    action: syncResult.saveBackups.restored
                      ? t('settings.data.webdav.saveBackupsRestored')
                      : syncResult.saveBackups.archiveUpdated
                        ? t('settings.data.webdav.saveBackupsUploaded')
                        : t('settings.data.webdav.saveBackupsUnchanged'),
                    verified: syncResult.saveBackups.verified
                      ? t('settings.data.webdav.verified')
                      : t('settings.data.webdav.unverified'),
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </OreModal>
  );
};
