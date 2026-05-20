import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../../ui/i18';
import { CloudCog, RefreshCw, Save } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreSwitch } from '../../../../../../ui/primitives/OreSwitch';
import type { WebDavSettings } from '../../../../../../types/settings';
import type { WebDavFavoriteSyncResult } from '../types';

interface WebDavSettingsModalProps {
  isOpen: boolean;
  draft: WebDavSettings;
  isSyncing: boolean;
  syncResult: WebDavFavoriteSyncResult | null;
  error: string;
  onClose: () => void;
  onChange: (patch: Partial<WebDavSettings>) => void;
  onSave: () => void;
  onSyncFavorites: () => Promise<void>;
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
  onSyncFavorites,
}) => {
  const { t } = useTranslation();
  const endpointHint = useMemo(() => getEndpointHint(draft.address), [draft.address]);
  const canSync = draft.address.trim() !== '' && draft.syncFavorites && !isSyncing;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.webdav.title')}
      defaultFocusKey="webdav-address"
      className="w-[52rem] max-w-[calc(100vw-2rem)]"
      actions={(
        <div className="flex flex-row justify-end gap-3">
          <OreButton
            variant="secondary"
            onClick={onClose}
            focusKey="webdav-cancel"
            disabled={isSyncing}
          >
            {t('settings.data.webdav.close')}
          </OreButton>
          <OreButton
            variant="secondary"
            onClick={onSave}
            focusKey="webdav-save"
            disabled={isSyncing}
          >
            <Save size={16} className="mr-1.5" />
            {t('settings.data.webdav.save')}
          </OreButton>
          <OreButton
            variant="primary"
            onClick={() => { void onSyncFavorites(); }}
            focusKey="webdav-sync"
            disabled={!canSync}
          >
            <RefreshCw size={16} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('settings.data.webdav.syncing') : t('settings.data.webdav.syncNow')}
          </OreButton>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
        <section className="grid min-w-0 gap-4">
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

        <aside className="grid min-w-0 gap-4">
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
              <div className="font-minecraft text-sm text-white">{t('settings.data.webdav.libraryFavorites')}</div>
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
        </aside>
      </div>

      {(error || syncResult) && (
        <div className="mt-4 grid gap-3">
          {error && (
            <div className="border-2 border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {syncResult && (
            <div className="border-2 border-[#1D4D13] bg-[#1C2A1B] px-3 py-2 text-sm leading-6 text-[#A7F08A]">
              已完成：上传 {syncResult.uploadedOperations} 条操作、下载 {syncResult.downloadedOperations} 条操作。
              当前基于 {syncResult.totalOperations} 条操作重建出 {syncResult.mergedFavorites} 条收藏，
              快照{syncResult.snapshotUpdated ? '已更新' : '未更新'}
              {syncResult.compactedOperations > 0 ? `，本轮压缩 ${syncResult.compactedOperations} 条旧操作。` : '。'}
            </div>
          )}
        </div>
      )}
    </OreModal>
  );
};
