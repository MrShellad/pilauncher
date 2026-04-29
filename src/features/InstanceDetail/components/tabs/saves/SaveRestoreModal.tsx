import React, { useEffect, useMemo, useRef, useState } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  RotateCcw,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ControlHint } from '../../../../../ui/components/ControlHint';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';

import {
  saveService,
  type SaveBackupMetadata,
  type SaveRestoreCheckResult,
} from '../../../logic/saveService';

// Loader Icons
import fabricIcon from '../../../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../../../assets/icons/tags/loaders/quilt.svg';
import vanillaIcon from '../../../../../assets/icons/tags/loaders/vanilla.svg';
import liteloaderIcon from '../../../../../assets/icons/tags/loaders/liteloader.svg';
import legacyFabricIcon from '../../../../../assets/icons/tags/loaders/legacy-fabric.svg';

const LOADER_ICON_MAP: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  vanilla: vanillaIcon,
  minecraft: vanillaIcon,
  liteloader: liteloaderIcon,
  'legacy-fabric': legacyFabricIcon,
  legacyfabric: legacyFabricIcon,
};

interface SaveRestoreModalProps {
  instanceId: string;
  backupMeta: SaveBackupMetadata | null;
  isRestoring: boolean;
  formatDate: (timestamp: number) => string;
  formatSize: (bytes: number) => string;
  onClose: () => void;
  onConfirmRestore: (payload: { backupId: string; restoreConfigs: boolean }) => Promise<void>;
}

const formatTrigger = (t: TFunction, trigger: string) => {
  switch (trigger) {
    case 'manual':
      return t('saves.triggers.manual', { defaultValue: 'Manual Backup' });
    case 'auto_exit':
      return t('saves.triggers.autoExit', { defaultValue: 'Backup on Exit' });
    case 'auto_interval':
      return t('saves.triggers.autoInterval', { defaultValue: 'Scheduled Backup' });
    case 'restore_guard':
      return t('saves.triggers.restoreGuard', { defaultValue: 'Pre-restore Guard' });
    case 'legacy':
      return t('saves.triggers.legacy', { defaultValue: 'Legacy Snapshot' });
    default:
      return trigger || t('saves.triggers.unknown', { defaultValue: 'Unknown Source' });
  }
};

const renderStatus = (matched: boolean, label: string, statusText: string) => (
  <div
    className={`ore-save-restore-modal__status-row ${
      matched
        ? 'ore-save-restore-modal__status-row--ok'
        : 'ore-save-restore-modal__status-row--warn'
    }`}
    aria-label={`${label}: ${statusText}`}
  >
    <span className="ore-save-restore-modal__status-copy">
      <span className="ore-save-restore-modal__status-icon" aria-hidden="true">
        {matched ? <CheckCircle2 size={15} /> : <X size={15} strokeWidth={3} />}
      </span>
      <span className="ore-save-restore-modal__status-label">{label}</span>
    </span>
    <span className="ore-save-restore-modal__status-state">{statusText}</span>
  </div>
);

const localizeRestoreWarning = (t: TFunction, warning: string) => {
  const normalized = warning.trim();

  const minecraftMismatch = normalized.match(
    /^minecraft version mismatch: current (.+), backup (.+)$/i
  );
  if (minecraftMismatch) {
    return t('saves.restoreModal.warnings.minecraftMismatch', {
      current: minecraftMismatch[1],
      backup: minecraftMismatch[2],
      defaultValue: normalized,
    });
  }

  const loaderMismatch = normalized.match(/^loader mismatch: current (.+), backup (.+)$/i);
  if (loaderMismatch) {
    return t('saves.restoreModal.warnings.loaderMismatch', {
      current: loaderMismatch[1],
      backup: loaderMismatch[2],
      defaultValue: normalized,
    });
  }

  const modEnvironmentDiffers = normalized.match(
    /^mod environment differs: current (\d+) mods, backup (\d+) mods$/i
  );
  if (modEnvironmentDiffers) {
    return t('saves.restoreModal.warnings.modEnvironmentDiffers', {
      current: Number(modEnvironmentDiffers[1]),
      backup: Number(modEnvironmentDiffers[2]),
      defaultValue: normalized,
    });
  }

  const missingMod = normalized.match(/^missing mod: (.+)$/i);
  if (missingMod) {
    return t('saves.restoreModal.warnings.missingMod', {
      fileName: missingMod[1],
      defaultValue: normalized,
    });
  }

  const changedMod = normalized.match(/^changed mod: (.+)$/i);
  if (changedMod) {
    return t('saves.restoreModal.warnings.changedMod', {
      fileName: changedMod[1],
      defaultValue: normalized,
    });
  }

  const extraMod = normalized.match(/^extra mod: (.+)$/i);
  if (extraMod) {
    return t('saves.restoreModal.warnings.extraMod', {
      fileName: extraMod[1],
      defaultValue: normalized,
    });
  }

  if (
    normalized ===
    'config snapshot differs from the current instance. Enable config restore to fully roll back.'
  ) {
    return t('saves.restoreModal.warnings.configSnapshotDiffers', {
      defaultValue: normalized,
    });
  }

  if (
    normalized ===
    'this snapshot was marked as non-safe and may have been created while the world was active.'
  ) {
    return t('saves.restoreModal.warnings.unsafeSnapshot', {
      defaultValue: normalized,
    });
  }

  return normalized;
};

const localizeRestoreError = (t: TFunction, errorMessage: string) => {
  const normalized = errorMessage.trim().replace(/^Error:\s*/i, '');

  if (normalized === 'backup snapshot not found') {
    return t('saves.restoreModal.errors.backupNotFound', {
      defaultValue: 'Backup snapshot not found.',
    });
  }

  return normalized;
};

export const SaveRestoreModal: React.FC<SaveRestoreModalProps> = ({
  instanceId,
  backupMeta,
  isRestoring,
  formatDate,
  formatSize,
  onClose,
  onConfirmRestore,
}) => {
  const { t } = useTranslation();
  const inputMode = useInputMode();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<SaveRestoreCheckResult | null>(null);
  const [restoreConfigs, setRestoreConfigs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!backupMeta) {
      setVerifyResult(null);
      setRestoreConfigs(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsVerifying(true);
    setVerifyResult(null);
    setRestoreConfigs(false);
    setErrorMessage(null);

    saveService
      .verifyRestore(instanceId, backupMeta.backupId)
      .then((result) => {
        if (cancelled) return;
        setVerifyResult(result);
        window.setTimeout(() => {
          if (result.canRestoreConfigs) {
            setFocus('save-restore-toggle-configs');
            return;
          }

          setFocus(result.warnings.length > 0 ? 'btn-cancel-restore' : 'btn-confirm-restore');
        }, 60);
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsVerifying(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backupMeta, instanceId]);

  useEffect(() => {
    if (!backupMeta) return undefined;

    let frameId = 0;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const activeGamepad = gamepads.find((gamepad): gamepad is Gamepad => gamepad !== null);
      const scrollElement = scrollRef.current;

      if (activeGamepad && scrollElement) {
        const rightStickY = activeGamepad.axes[3] ?? 0;
        const deadZone = 0.12;

        if (Math.abs(rightStickY) > deadZone) {
          const scrollSpeed = Math.min(32, Math.max(14, window.innerHeight * 0.016));
          scrollElement.scrollTop += rightStickY * scrollSpeed;
        }
      }

      frameId = window.requestAnimationFrame(pollGamepad);
    };

    frameId = window.requestAnimationFrame(pollGamepad);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [backupMeta]);

  const focusOrder = useMemo(() => {
    if (!verifyResult?.canRestoreConfigs) {
      return ['btn-cancel-restore', 'btn-confirm-restore'];
    }

    return ['save-restore-toggle-configs', 'btn-cancel-restore', 'btn-confirm-restore'];
  }, [verifyResult]);

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    focusOrder[0],
    false,
    !!backupMeta && !isVerifying
  );

  if (!backupMeta) return null;

  const warnings = verifyResult?.warnings ?? [];
  const localizedWarnings = warnings.map((warning) => localizeRestoreWarning(t, warning));
  const localizedError = errorMessage ? localizeRestoreError(t, errorMessage) : null;
  const isSafe = warnings.length === 0 && !localizedError;
  const canConfirmRestore = !isVerifying && !isRestoring && !!verifyResult && !localizedError;
  const loaderLabel =
    [backupMeta.game.loader, backupMeta.game.loaderVersion].filter(Boolean).join(' ').trim() ||
    t('saves.restoreModal.labels.unknownLoader', { defaultValue: 'Unknown Loader' });

  const loaderIconSrc = LOADER_ICON_MAP[backupMeta.game.loader?.toLowerCase()];

  const statusMatchText = t('saves.restoreModal.labels.matches', { defaultValue: 'matches' });
  const statusDiffersText = t('saves.restoreModal.labels.differs', { defaultValue: 'differs' });
  const heroTone = isVerifying ? 'loading' : isSafe ? 'safe' : 'warning';
  const heroTitle = isVerifying
    ? t('saves.restoreModal.hero.verifyingTitle', {
        defaultValue: 'Verifying Backup Environment',
      })
    : isSafe
      ? t('saves.restoreModal.hero.safeTitle', {
          defaultValue: 'Ready for a Safe Restore',
        })
      : t('saves.restoreModal.hero.warningTitle', {
          defaultValue: 'Review Differences Before Restore',
        });

  const heroDescription = isVerifying
    ? t('saves.restoreModal.hero.verifyingDescription', {
        defaultValue:
          'Comparing the current instance against the backup snapshot for Minecraft version, loader, mods, and configs.',
      })
    : t('saves.restoreModal.hero.defaultDescription', {
        defaultValue:
          'A guard backup of the current world will be created before the selected snapshot is restored.',
      });

  const handleRestore = async () => {
    setErrorMessage(null);

    try {
      await onConfirmRestore({
        backupId: backupMeta.backupId,
        restoreConfigs,
      });
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const actions = (
    <div className="ore-save-restore-modal__footer">
      {verifyResult?.canRestoreConfigs && !isVerifying && (
        <div className="ore-save-restore-modal__option ore-save-restore-modal__footer-option">
          <FocusItem
            focusKey="save-restore-toggle-configs"
            onEnter={() => setRestoreConfigs((value) => !value)}
            onArrowPress={handleLinearArrow}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                type="button"
                onClick={() => setRestoreConfigs((value) => !value)}
                className={`ore-save-restore-modal__toggle ${focused ? 'is-focused' : ''}`}
              >
                <span
                  className={`ore-save-restore-modal__checkbox ${
                    restoreConfigs ? 'is-checked' : ''
                  }`}
                >
                  <CheckCircle2 size={14} />
                </span>

                <span className="min-w-0">
                  <span className="ore-save-restore-modal__option-title font-minecraft">
                    {t('saves.restoreModal.toggle.title', {
                      defaultValue: 'Restore Config Files Too',
                    })}
                  </span>
                  <span className="ore-save-restore-modal__option-text">
                    {t('saves.restoreModal.toggle.description', {
                      defaultValue:
                        'This replaces the current `config` and `defaultconfigs`. Enable it when you want a full rollback of both the world and configs.',
                    })}
                  </span>
                </span>
              </button>
            )}
          </FocusItem>
        </div>
      )}

      {inputMode === 'controller' && (
        <div className="ore-save-restore-modal__footer-meta">
          <div className="ore-save-restore-modal__scroll-hint">
            <ControlHint label="RS" variant="keyboard" tone="dark" />
            <span>{t('saves.restoreModal.hints.scrollInfo', { defaultValue: 'Right stick scrolls the details' })}</span>
          </div>
        </div>
      )}

      <div className="ore-save-restore-modal__actions">
        <OreButton
          focusKey="btn-cancel-restore"
          variant="secondary"
          size="full"
          onArrowPress={handleLinearArrow}
          onClick={onClose}
          className="ore-save-restore-modal__action-button"
        >
          <XCircle size={18} className="mr-2" />
          {t('saves.restoreModal.actions.cancel', { defaultValue: 'Cancel' })}
        </OreButton>

        <OreButton
          focusKey="btn-confirm-restore"
          variant={isSafe ? 'primary' : 'danger'}
          size="full"
          onArrowPress={handleLinearArrow}
          onClick={handleRestore}
          disabled={!canConfirmRestore}
          className="ore-save-restore-modal__action-button"
        >
          {isVerifying || isRestoring ? (
            <Loader2 size={18} className="mr-2 animate-spin" />
          ) : (
            <RotateCcw size={18} className="mr-2" />
          )}
          {isSafe
            ? t('saves.restoreModal.actions.confirm', {
                defaultValue: 'Confirm Restore',
              })
            : t('saves.restoreModal.actions.proceed', {
                defaultValue: 'Continue Restore',
              })}
        </OreButton>
      </div>
    </div>
  );

  return (
    <OreModal
      isOpen={!!backupMeta}
      onClose={onClose}
      title={t('saves.restoreModal.title', { defaultValue: 'Restore Save Backup' })}
      className="ore-save-restore-modal"
      contentClassName="ore-save-restore-modal__content"
      defaultFocusKey={focusOrder[0]}
      actions={actions}
    >
      <FocusBoundary id="save-restore-boundary" className="flex h-full min-h-0 flex-col">
        <div className={`ore-save-restore-modal__hero ore-save-restore-modal__hero--${heroTone}`}>
          <div
            className={`ore-save-restore-modal__hero-icon ore-save-restore-modal__hero-icon--${heroTone}`}
          >
            {isVerifying ? (
              <Loader2 size={28} className="animate-spin" />
            ) : isSafe ? (
              <ShieldCheck size={28} />
            ) : (
              <AlertTriangle size={28} />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="ore-save-restore-modal__hero-title font-minecraft">{heroTitle}</h3>
            <p className="ore-save-restore-modal__hero-text">{heroDescription}</p>
          </div>
        </div>

        <div ref={scrollRef} className="ore-save-restore-modal__body custom-scrollbar">
          <div className="ore-save-restore-modal__grid">
            <section className="ore-save-restore-modal__panel">
              <p className="ore-save-restore-modal__panel-label">
                {t('saves.restoreModal.sections.targetWorld', { defaultValue: 'Target World' })}
              </p>
              <p className="ore-save-restore-modal__panel-value font-minecraft">
                {backupMeta.world.name}
              </p>
              <p className="ore-save-restore-modal__panel-subtext">
                {t('saves.restoreModal.labels.folder', { defaultValue: 'Folder' })}:
                {' '}
                {backupMeta.world.folderName}
              </p>
            </section>

            <section className="ore-save-restore-modal__panel">
              <p className="ore-save-restore-modal__panel-label">
                {t('saves.restoreModal.sections.backupInfo', { defaultValue: 'Backup Info' })}
              </p>
              <p className="ore-save-restore-modal__panel-value">
                {formatDate(backupMeta.createdAt)}
              </p>
              <p className="ore-save-restore-modal__panel-subtext">
                {formatTrigger(t, backupMeta.trigger)}
                {' '}
                ·
                {' '}
                {formatSize(backupMeta.files.totalSize)}
              </p>
            </section>

            <section className="ore-save-restore-modal__panel">
              <p className="ore-save-restore-modal__panel-label">
                {t('saves.restoreModal.sections.gameEnvironment', {
                  defaultValue: 'Game Environment',
                })}
              </p>
              <div className="ore-save-restore-modal__environment-layout">
                <div className="ore-save-restore-modal__environment-block">
                  <div className="ore-save-restore-modal__environment-row">
                    <span className="ore-save-restore-modal__environment-label">
                      <Package
                        size={16}
                        className="ore-save-restore-modal__environment-icon ore-save-restore-modal__environment-icon--core"
                      />
                      <span className="ore-save-restore-modal__environment-key">
                        {t('saves.restoreModal.labels.mcVersion', {
                          defaultValue: 'MC Version',
                        })}
                      </span>
                    </span>
                    <span className="ore-save-restore-modal__environment-value ore-save-restore-modal__environment-value--mono">
                      {backupMeta.game.mcVersion}
                    </span>
                  </div>

                  <div className="ore-save-restore-modal__environment-row">
                    <span className="ore-save-restore-modal__environment-label">
                      {loaderIconSrc ? (
                        <img
                          src={loaderIconSrc}
                          alt=""
                          className="ore-save-restore-modal__environment-custom-icon"
                        />
                      ) : (
                        <Wrench
                          size={16}
                          className="ore-save-restore-modal__environment-icon ore-save-restore-modal__environment-icon--loader"
                        />
                      )}
                      <span className="ore-save-restore-modal__environment-key">
                        {t('saves.restoreModal.labels.loaderVersion', {
                          defaultValue: 'Loader Version',
                        })}
                      </span>
                    </span>
                    <span className="ore-save-restore-modal__environment-value ore-save-restore-modal__environment-value--mono">
                      {loaderLabel}
                    </span>
                  </div>
                </div>

                {verifyResult && (
                  <div className="ore-save-restore-modal__status-panel">
                    <p className="ore-save-restore-modal__status-heading">
                      {t('saves.restoreModal.sections.environmentStatus', {
                        defaultValue: 'Environment Status',
                      })}
                    </p>
                    <div className="ore-save-restore-modal__status-list">
                      {renderStatus(
                        verifyResult.gameMatches,
                        t('saves.restoreModal.labels.mcVersion', { defaultValue: 'MC Version' }),
                        verifyResult.gameMatches ? statusMatchText : statusDiffersText
                      )}
                      {renderStatus(
                        verifyResult.loaderMatches,
                        t('saves.restoreModal.labels.loaderVersion', {
                          defaultValue: 'Loader Version',
                        }),
                        verifyResult.loaderMatches ? statusMatchText : statusDiffersText
                      )}
                      {renderStatus(
                        verifyResult.modsMatch,
                        t('saves.restoreModal.labels.mods', { defaultValue: 'Mods' }),
                        verifyResult.modsMatch ? statusMatchText : statusDiffersText
                      )}
                      {renderStatus(
                        verifyResult.configsMatch,
                        t('saves.restoreModal.labels.configs', { defaultValue: 'Configs' }),
                        verifyResult.configsMatch ? statusMatchText : statusDiffersText
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="ore-save-restore-modal__panel">
              <p className="ore-save-restore-modal__panel-label">
                {t('saves.restoreModal.sections.restoreStrategy', {
                  defaultValue: 'Restore Strategy',
                })}
              </p>
              <div className="ore-save-restore-modal__panel-main">
                <p className="ore-save-restore-modal__panel-value">
                  {t('saves.restoreModal.strategy.primary', {
                    defaultValue:
                      'Create a guard backup for the current world before restoring the selected snapshot.',
                  })}
                </p>
                <p className="ore-save-restore-modal__panel-subtext">
                  {t('saves.restoreModal.strategy.secondary', {
                    worldSize: formatSize(backupMeta.files.worldSize),
                    configSize: formatSize(backupMeta.files.configSize),
                    defaultValue: `World data ${formatSize(backupMeta.files.worldSize)}, config data ${formatSize(backupMeta.files.configSize)}.`,
                  })}
                </p>
                <div className="ore-save-restore-modal__metric-list">
                  <span className="ore-save-restore-modal__pill ore-save-restore-modal__pill--metric">
                    {backupMeta.state.safeBackup
                      ? t('saves.restoreModal.labels.safeSnapshot', {
                          defaultValue: 'Safe Snapshot',
                        })
                      : t('saves.restoreModal.labels.unsafeSnapshot', {
                          defaultValue: 'Unsafe Snapshot',
                        })}
                  </span>
                  <span className="ore-save-restore-modal__pill ore-save-restore-modal__pill--metric">
                    {t('saves.restoreModal.metrics.modCount', {
                      count: backupMeta.environment.modCount,
                      defaultValue: `${backupMeta.environment.modCount} Mods`,
                    })}
                  </span>
                  {backupMeta.hasConfigs && (
                    <span className="ore-save-restore-modal__pill ore-save-restore-modal__pill--metric">
                      {t('saves.restoreModal.labels.includesConfigSnapshot', {
                        defaultValue: 'Includes Config Snapshot',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>

          {!isVerifying && localizedWarnings.length > 0 && (
            <section className="ore-save-restore-modal__warning">
              <p className="ore-save-restore-modal__warning-title font-minecraft">
                {t('saves.restoreModal.warnings.title', { defaultValue: 'Risks Detected' })}
              </p>
              <div className="ore-save-restore-modal__warning-list custom-scrollbar">
                {localizedWarnings.map((warning, index) => (
                  <div
                    key={`${warning}-${index}`}
                    className="ore-save-restore-modal__warning-item"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            </section>
          )}

          {localizedError && (
            <section className="ore-save-restore-modal__error">
              {t('saves.restoreModal.errors.verifyFailed', {
                error: localizedError,
                defaultValue: `Unable to verify restore: ${localizedError}`,
              })}
            </section>
          )}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
