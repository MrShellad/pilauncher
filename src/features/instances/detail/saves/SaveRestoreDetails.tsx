import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import legacyFabricIcon from '../../../../assets/icons/tags/loaders/legacy-fabric.svg';
import fabricIcon from '../../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../../assets/icons/tags/loaders/forge.svg';
import liteloaderIcon from '../../../../assets/icons/tags/loaders/liteloader.svg';
import neoforgeIcon from '../../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../../assets/icons/tags/loaders/quilt.svg';
import vanillaIcon from '../../../../assets/icons/tags/loaders/vanilla.svg';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import type { SaveBackupMetadata, SaveRestoreCheckResult } from '../logic/saveService';

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

interface SaveRestoreDetailsProps {
  backupMeta: SaveBackupMetadata;
  verifyResult: SaveRestoreCheckResult | null;
  isVerifying: boolean;
  localizedWarnings: string[];
  localizedError: string | null;
  formatDate: (timestamp: number) => string;
  formatSize: (bytes: number) => string;
  scrollRef: RefObject<HTMLDivElement | null>;
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

export const SaveRestoreDetails: React.FC<SaveRestoreDetailsProps> = ({
  backupMeta,
  verifyResult,
  isVerifying,
  localizedWarnings,
  localizedError,
  formatDate,
  formatSize,
  scrollRef,
}) => {
  const { t } = useTranslation();
  const isSafe = localizedWarnings.length === 0 && !localizedError;
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

  return (
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
              {t('saves.restoreModal.labels.folder', { defaultValue: 'Folder' })}: {' '}
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
              {formatTrigger(t, backupMeta.trigger)} {' '}· {' '}
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
  );
};
