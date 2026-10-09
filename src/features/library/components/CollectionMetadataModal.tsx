import React, { useMemo, useState } from 'react';
import { PackageCheck, Save, Tags, Upload, Trash2 } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';

import type { Collection } from '../../../types/library';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown, type DropdownOption } from '../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';

type CoverMode = 'auto' | 'custom' | 'clear';

export interface CollectionTrackingInfo {
  gameVersion: string;
  loader: string;
  trackerId: string | null;
}

interface CollectionMetadataModalProps {
  collection: Collection | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (collection: Collection) => Promise<void> | void;
  /** Tracking info for mod_set collections. When provided, tracking fields are shown. */
  trackingInfo?: CollectionTrackingInfo | null;
  /** Called when tracking fields change. Only fired for mod_set collections. */
  onSaveTracking?: (gameVersion: string, loader: string) => void;
  trackingVersionOptions?: DropdownOption[];
  trackingLoaderOptions?: DropdownOption[];
}

interface CollectionMetadataModalBodyProps extends Omit<CollectionMetadataModalProps, 'collection'> {
  collection: Collection;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

const CollectionMetadataModalBody: React.FC<CollectionMetadataModalBodyProps> = ({
  collection,
  isSaving = false,
  onClose,
  onSave,
  trackingInfo,
  onSaveTracking,
  trackingVersionOptions = [],
  trackingLoaderOptions = [],
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(collection.name);
  const [coverMode, setCoverMode] = useState<CoverMode>(collection.coverImage ? 'custom' : 'auto');
  const [coverImage, setCoverImage] = useState(collection.coverImage ?? '');
  const [error, setError] = useState('');
  const [trackingGameVersion, setTrackingGameVersion] = useState(trackingInfo?.gameVersion ?? '');
  const [trackingLoader, setTrackingLoader] = useState(trackingInfo?.loader ?? 'fabric');

  const isModSet = collection.type === 'mod_set';
  const hasTracking = isModSet && trackingInfo != null;

  const typeLabel = collection.type === 'modpack'
    ? t('libraryPage.views.modpack')
    : t('libraryPage.views.modSet');
  const trimmedCoverImage = coverImage.trim();
  const canSubmit = Boolean(name.trim()) && !isSaving;

  const previewSrc = useMemo(() => {
    if (coverMode === 'custom' && trimmedCoverImage) {
      if (trimmedCoverImage.startsWith('http://') || trimmedCoverImage.startsWith('https://') || trimmedCoverImage.startsWith('data:')) {
        return trimmedCoverImage;
      }
      try {
        return convertFileSrc(trimmedCoverImage);
      } catch {
        return trimmedCoverImage;
      }
    }
    return '';
  }, [coverMode, trimmedCoverImage]);

  const mergedVersionOptions = useMemo(() => {
    if (!trackingGameVersion) return trackingVersionOptions;
    if (trackingVersionOptions.some((opt) => opt.value === trackingGameVersion)) {
      return trackingVersionOptions;
    }
    return [{ label: trackingGameVersion, value: trackingGameVersion }, ...trackingVersionOptions];
  }, [trackingVersionOptions, trackingGameVersion]);

  const handleSubmit = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError(t('libraryPage.metadata.nameRequired'));
      return;
    }

    const nextCoverImage = coverMode === 'custom' && trimmedCoverImage ? trimmedCoverImage : undefined;

    await onSave({
      ...collection,
      name: nextName,
      coverImage: nextCoverImage,
      updatedAt: nowSeconds(),
    });

    // Save tracking changes if applicable
    if (hasTracking && onSaveTracking) {
      const nextGameVersion = trackingGameVersion.trim();
      const nextLoader = trackingLoader.trim().toLowerCase();
      if (nextGameVersion && nextLoader) {
        const versionChanged = nextGameVersion !== trackingInfo.gameVersion;
        const loaderChanged = nextLoader !== trackingInfo.loader;
        if (versionChanged || loaderChanged) {
          onSaveTracking(nextGameVersion, nextLoader);
        }
      }
    }
  };

  const handleSelectCover = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      });
      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });
        setCoverImage(newPath);
        setCoverMode('custom');
      }
    } catch (err) {
      console.error('[CollectionMetadataModal] failed to select image:', err);
    }
  };

  const handleClearCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoverImage('');
    setCoverMode('auto');
  };

  return (
    <OreModal
      isOpen
      onClose={onClose}
      title={t('libraryPage.metadata.title', { type: typeLabel })}
      className="w-[38rem] max-w-[calc(100vw-2rem)]"
      actionsClassName="!justify-center"
      actions={(
        <>
          <OreButton variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </OreButton>
          <OreButton
            variant="primary"
            focusKey="collection-metadata-save"
            disabled={!canSubmit}
            onClick={() => { void handleSubmit(); }}
          >
            <span className="flex items-center gap-2">
              <Save size={16} />
              {t('libraryPage.metadata.save')}
            </span>
          </OreButton>
        </>
      )}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4">
          <div
            className="group relative flex aspect-square h-[4.5rem] w-[4.5rem] cursor-pointer items-center justify-center overflow-hidden border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)] text-[var(--ore-color-text-secondary-soft)] shadow-[inset_0_-2px_0_rgba(0,0,0,0.35)] transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => { void handleSelectCover(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void handleSelectCover();
              }
            }}
          >
            {previewSrc ? (
              <>
                <img
                  src={previewSrc}
                  alt=""
                  className="h-full w-full object-cover transition-all group-hover:opacity-40"
                  draggable={false}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={handleClearCover}
                    className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-black/60 text-white transition-colors hover:bg-red-500/80"
                    title={t('libraryPage.metadata.clearCover')}
                  >
                    <Trash2 size={12} />
                  </button>
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-black/60 text-white transition-colors hover:bg-white/30"
                    title={t('libraryPage.metadata.changeCover')}
                  >
                    <Upload size={12} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <PackageCheck size={34} strokeWidth={2.25} className="transition-all group-hover:opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-black/60 text-white transition-colors hover:bg-white/30">
                    <Upload size={14} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-3 py-2 text-sm leading-6 text-[var(--ore-color-text-secondary-default)]">
            <div className="flex items-center gap-2 font-minecraft text-base text-white">
              <Tags size={16} className="shrink-0 text-[var(--ore-color-text-success-default)]" />
              <span className="truncate">{collection.name}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--ore-color-text-muted-default)]">
              {t(isModSet ? 'libraryPage.metadata.hintModSet' : 'libraryPage.metadata.hint')}
            </div>
          </div>
        </div>

        <OreInput
          label={t('libraryPage.metadata.name')}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          disabled={isSaving}
          focusKey="collection-metadata-name"
        />



        {hasTracking && (
          <div className="grid gap-3 border-t-2 border-[var(--ore-color-border-primary-default)] pt-4">
            <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-3 text-sm leading-6 text-[var(--ore-color-text-secondary-default)]">
              <div className="font-minecraft text-base text-white">{t('libraryPage.metadata.trackingTitle')}</div>
              <div className="mt-1 text-xs text-[var(--ore-color-text-muted-default)]">
                {t('libraryPage.metadata.trackingDesc')}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 font-minecraft text-sm text-white">{t('libraryPage.metadata.minecraftVersion')}</div>
                <OreDropdown
                  focusKey="modset-tracking-version"
                  options={mergedVersionOptions}
                  value={trackingGameVersion}
                  onChange={setTrackingGameVersion}
                  placeholder={t('libraryPage.metadata.selectVersion')}
                  searchable
                  portal
                  panelWidth="trigger"
                  lazy
                  lazyBatchSize={48}
                />
              </div>

              <div className="min-w-0">
                <div className="mb-1 font-minecraft text-sm text-white">Loader</div>
                <OreDropdown
                  focusKey="modset-tracking-loader"
                  options={trackingLoaderOptions}
                  value={trackingLoader}
                  onChange={setTrackingLoader}
                  portal
                  panelWidth="trigger"
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="border-2 border-[var(--ore-color-border-danger-subtle)] bg-[var(--ore-color-background-danger-muted)] px-3 py-2 text-sm text-[var(--ore-color-text-danger-soft)]">
            {error}
          </div>
        )}
      </div>
    </OreModal>
  );
};

export const CollectionMetadataModal: React.FC<CollectionMetadataModalProps> = ({
  collection,
  trackingInfo,
  ...props
}) => {
  if (!collection) return null;

  return (
    <CollectionMetadataModalBody
      key={`${collection.id}:${collection.updatedAt}:${trackingInfo?.gameVersion ?? ''}:${trackingInfo?.loader ?? ''}`}
      collection={collection}
      trackingInfo={trackingInfo}
      {...props}
    />
  );
};
