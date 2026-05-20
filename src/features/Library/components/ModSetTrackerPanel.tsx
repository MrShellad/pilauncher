import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Download, Loader2, Monitor, Plus, RefreshCw, Square, CheckSquare, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import { useLauncherStore } from '../../../store/useLauncherStore';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreProgressBar } from '../../../ui/primitives/OreProgressBar';
import {
  createInstanceForTracker,
  getCompatibleInstancesForTracker,
  installTrackerToInstance,
  type CompatibleInstance,
} from '../logic/modSetInstaller';
import type { ModSetTracker } from '../stores/useModSetTrackerStore';

interface ModSetTrackerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: ModSetTracker[];
  isChecking: boolean;
  onCheck: (trackerId: string) => void;
  onRemove: (trackerId: string) => void;
  directInstallTrackerId?: string | null;
  onDirectInstallHandled?: () => void;
}

type InstallMode = 'existing' | 'new';

export const ModSetTrackerPanel: React.FC<ModSetTrackerPanelProps> = ({
  isOpen,
  onClose,
  trackers,
  isChecking,
  onCheck,
  onRemove,
  directInstallTrackerId,
  onDirectInstallHandled,
}) => {
  const { t } = useTranslation();
  const setInstances = useLauncherStore((state) => state.setInstances);
  const [installTracker, setInstallTracker] = useState<ModSetTracker | null>(null);
  const [compatibleInstances, setCompatibleInstances] = useState<CompatibleInstance[]>([]);
  const [installMode, setInstallMode] = useState<InstallMode>('existing');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installNotice, setInstallNotice] = useState('');
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    if (!directInstallTrackerId) return;

    const tracker = trackers.find((item) => item.id === directInstallTrackerId);
    if (tracker) {
      setInstallTracker(tracker);
    }
    onDirectInstallHandled?.();
  }, [directInstallTrackerId, onDirectInstallHandled, trackers]);

  useEffect(() => {
    if (!installTracker) return;

    let cancelled = false;
    setCompatibleInstances([]);
    setSelectedInstanceId('');
    setInstallNotice('');
    setInstallError('');
    setNewInstanceName(`${installTracker.collectionName} ${installTracker.gameVersion} ${installTracker.loader}`);
    setIsLoadingTargets(true);

    getCompatibleInstancesForTracker(installTracker)
      .then((instances) => {
        if (cancelled) return;
        setCompatibleInstances(instances || []);
        setSelectedInstanceId(instances?.[0]?.id || '');
        setInstallMode(instances?.length ? 'existing' : 'new');
      })
      .catch((error) => {
        console.error('[ModSetTracker] failed to load compatible instances', error);
        if (!cancelled) {
          setInstallMode('new');
          setInstallError(t('libraryPage.tracker.loadTargetsFailed', { error: String(error) }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTargets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [installTracker]);

  const closeInstallModal = () => {
    if (isInstalling) return;
    setInstallTracker(null);
    setCompatibleInstances([]);
    setSelectedInstanceId('');
    setInstallNotice('');
    setInstallError('');
  };

  const refreshInstances = async () => {
    try {
      const instances = await invoke<unknown[]>('get_all_instances', { forceRefresh: true });
      setInstances(instances || []);
    } catch (error) {
      console.warn('[ModSetTracker] failed to refresh instances after install', error);
    }
  };

  const handleInstall = async () => {
    if (!installTracker || isInstalling) return;
    if (installMode === 'existing' && !selectedInstanceId) return;

    setIsInstalling(true);
    setInstallError('');
    setInstallNotice(installMode === 'new' ? t('libraryPage.tracker.creatingInstance') : t('libraryPage.tracker.deploying'));

    try {
      const targetInstanceId = installMode === 'new'
        ? await createInstanceForTracker(installTracker, newInstanceName)
        : selectedInstanceId;

      if (installMode === 'new') {
        await refreshInstances();
      }

      setInstallNotice(t('libraryPage.tracker.downloading'));
      const result = await installTrackerToInstance(installTracker, targetInstanceId);
      setInstallNotice(t('libraryPage.tracker.result', {
        installed: result.installed,
        skipped: result.skipped,
        failed: result.failed,
      }));
      await refreshInstances();
    } catch (error) {
      console.error('[ModSetTracker] install failed', error);
      setInstallError(t('libraryPage.tracker.installFailed', { error: String(error) }));
    } finally {
      setIsInstalling(false);
    }
  };

  if (trackers.length === 0 && !isOpen) return null;

  return (
    <>
      <OreModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('libraryPage.tracker.title', { count: trackers.length })}
        className="w-[1200px] max-w-full"
      >
        <div className="grid gap-3">
          {trackers.length === 0 ? (
            <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-6 text-center text-sm text-[var(--ore-color-text-muted-default)]">
              {t('libraryPage.tracker.empty')}
            </div>
          ) : (
            trackers.map((tracker) => {
              const percent = tracker.totalCount > 0
                ? Math.round((tracker.readyCount / tracker.totalCount) * 100)
                : 0;
              const isReady = tracker.readinessStatus === 'ready';
              const canInstall = tracker.readyCount > 0;

              return (
                <article
                  key={tracker.id}
                  className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] p-2 shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.1),inset_0_-0.25rem_0_rgba(0,0,0,0.26)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="truncate font-minecraft text-base text-white ore-text-shadow">
                        {tracker.collectionName}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--ore-color-text-muted-default)]">
                        <span>MC {tracker.gameVersion}</span>
                        <span>|</span>
                        <span>{tracker.loader}</span>
                        <span>|</span>
                        <span>{t('libraryPage.tracker.readyCount', { ready: tracker.readyCount, total: tracker.totalCount })}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className={`flex h-8 items-center gap-1.5 border-2 border-[var(--ore-color-border-primary-default)] px-2 font-minecraft text-xs ${isReady ? 'bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]' : 'bg-[var(--ore-color-background-surface-sunken)] text-[var(--ore-color-text-secondary-default)]'
                        }`}>
                        {isReady ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                        {isReady ? 'READY' : `${percent}%`}
                      </div>

                      <OreButton
                        variant="primary"
                        size="sm"
                        disabled={!canInstall || isChecking}
                        className="!h-8 !min-w-0 !px-2"
                        onClick={() => setInstallTracker(tracker)}
                        title={canInstall ? t('libraryPage.tracker.install') : t('libraryPage.tracker.noInstallable')}
                      >
                        <Download size={14} />
                      </OreButton>
                      <OreButton
                        variant="secondary"
                        size="sm"
                        disabled={isChecking}
                        className="!h-8 !min-w-0 !px-2"
                        onClick={() => onCheck(tracker.id)}
                        title={t('libraryPage.tracker.checkNow')}
                      >
                        <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
                      </OreButton>
                      <OreButton
                        variant="danger"
                        size="sm"
                        className="!h-8 !min-w-0 !px-2"
                        onClick={() => onRemove(tracker.id)}
                        title={t('libraryPage.tracker.remove')}
                      >
                        <Trash2 size={14} />
                      </OreButton>
                    </div>
                  </div>

                  <OreProgressBar
                    percent={percent}
                    className="mt-2 !space-y-0 !px-0 [&>div:last-child]:hidden"
                  />
                </article>
              );
            })
          )}
        </div>
      </OreModal>

      <OreModal
        isOpen={!!installTracker}
        onClose={closeInstallModal}
        title={t('libraryPage.tracker.install')}
        className="w-[760px] max-w-[calc(100vw-2rem)]"
        contentClassName="grid gap-4 overflow-y-auto p-5"
        actions={(
          <>
            <div className="mr-auto text-xs text-[var(--ore-color-text-muted-default)]">
              {installTracker ? t('libraryPage.tracker.deployableCount', { ready: installTracker.readyCount, total: installTracker.totalCount }) : ''}
            </div>
            <OreButton variant="secondary" disabled={isInstalling} onClick={closeInstallModal}>
              {t('libraryPage.tracker.close')}
            </OreButton>
            <OreButton
              focusKey="modset-install-confirm"
              variant="primary"
              disabled={
                isInstalling ||
                isLoadingTargets ||
                !installTracker ||
                (installMode === 'existing' && !selectedInstanceId)
              }
              onClick={() => { void handleInstall(); }}
            >
              {isInstalling ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
              {isInstalling ? t('libraryPage.tracker.deployingShort') : t('libraryPage.tracker.confirmDeploy')}
            </OreButton>
          </>
        )}
      >
        {installTracker && (
          <>
            <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-3 text-sm leading-6 text-[var(--ore-color-text-secondary-default)]">
              <div className="font-minecraft text-base text-white">{installTracker.collectionName}</div>
              <div className="mt-1 text-xs">
                {t('libraryPage.tracker.targetEnv', { version: installTracker.gameVersion, loader: installTracker.loader })}
              </div>
              {installTracker.readinessStatus !== 'ready' && (
                <div className="mt-2 border-2 border-[var(--ore-color-border-warning-subtle)] bg-[var(--ore-color-background-warning-subtle)] p-2 text-xs text-[var(--ore-color-text-warning-soft)]">
                  {t('libraryPage.tracker.notReadyWarning')}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                disabled={compatibleInstances.length === 0 || isInstalling}
                onClick={() => setInstallMode('existing')}
                className={[
                  'flex items-center gap-3 border-2 p-3 text-left transition-none',
                  installMode === 'existing'
                    ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                    : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-neutral-default)] text-[var(--ore-color-text-onLight-soft)] hover:bg-[var(--ore-color-background-neutral-subtle)]',
                  compatibleInstances.length === 0 ? 'opacity-50' : '',
                ].join(' ')}
              >
                {installMode === 'existing' ? <CheckSquare size={18} /> : <Square size={18} />}
                <Monitor size={20} />
                <div className="min-w-0">
                  <div className="font-minecraft text-sm">{t('libraryPage.tracker.installExisting')}</div>
                  <div className="text-xs opacity-75">
                    {isLoadingTargets ? t('libraryPage.tracker.loadingTargets') : t('libraryPage.tracker.compatibleCount', { count: compatibleInstances.length })}
                  </div>
                </div>
              </button>

              {installMode === 'existing' && compatibleInstances.length > 0 && (
                <div className="grid max-h-52 gap-2 overflow-y-auto border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-sunken)] p-2 custom-scrollbar">
                  {compatibleInstances.map((instance) => {
                    const selected = selectedInstanceId === instance.id;
                    return (
                      <button
                        key={instance.id}
                        type="button"
                        disabled={isInstalling}
                        onClick={() => setSelectedInstanceId(instance.id)}
                        className={[
                          'flex items-center gap-3 border-2 p-2 text-left',
                          selected
                            ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                            : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-neutral-default)] text-[var(--ore-color-text-onLight-soft)] hover:bg-[var(--ore-color-background-neutral-subtle)]',
                        ].join(' ')}
                      >
                        {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-minecraft text-sm">{instance.name}</div>
                          <div className="truncate text-xs opacity-75">
                            {instance.version || t('libraryPage.tracker.unknownVersion')} | {instance.loader || t('libraryPage.tracker.unknownLoader')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={isInstalling}
                onClick={() => setInstallMode('new')}
                className={[
                  'flex items-center gap-3 border-2 p-3 text-left transition-none',
                  installMode === 'new'
                    ? 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                    : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-neutral-default)] text-[var(--ore-color-text-onLight-soft)] hover:bg-[var(--ore-color-background-neutral-subtle)]',
                ].join(' ')}
              >
                {installMode === 'new' ? <CheckSquare size={18} /> : <Square size={18} />}
                <Plus size={20} />
                <div className="min-w-0">
                  <div className="font-minecraft text-sm">{t('libraryPage.tracker.createNew')}</div>
                  <div className="text-xs opacity-75">{t('libraryPage.tracker.createNewDesc')}</div>
                </div>
              </button>

              {installMode === 'new' && (
                <OreInput
                  value={newInstanceName}
                  onChange={(event) => setNewInstanceName(event.target.value)}
                  label={t('libraryPage.tracker.newInstanceName')}
                  placeholder={t('libraryPage.tracker.newInstanceNamePlaceholder')}
                  disabled={isInstalling}
                  focusKey="modset-new-instance-name"
                />
              )}
            </div>

            {(installNotice || installError) && (
              <div className={[
                'border-2 p-3 text-sm leading-6',
                installError
                  ? 'border-[var(--ore-color-border-danger-default)] bg-[var(--ore-color-background-danger-subtle)] text-[var(--ore-color-text-danger-default)]'
                  : 'border-[var(--ore-color-border-success-active)] bg-[var(--ore-color-background-success-subtle)] text-[var(--ore-color-text-success-soft)]',
              ].join(' ')}
              >
                {installError || installNotice}
              </div>
            )}
          </>
        )}
      </OreModal>
    </>
  );
};
