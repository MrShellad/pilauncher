import type { TFunction } from 'i18next';

export const localizeRestoreWarning = (t: TFunction, warning: string) => {
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

export const localizeRestoreError = (t: TFunction, errorMessage: string) => {
  const normalized = errorMessage.trim().replace(/^Error:\s*/i, '');

  if (normalized === 'backup snapshot not found') {
    return t('saves.restoreModal.errors.backupNotFound', {
      defaultValue: 'Backup snapshot not found.',
    });
  }

  const baseMissingMatch = normalized.match(/^differential base backup is missing: (.+)$/i);
  if (baseMissingMatch) {
    return t('saves.restoreModal.errors.differentialBaseMissing', {
      baseId: baseMissingMatch[1],
      defaultValue: `差异备份的基础全量包已丢失或损坏 (ID: ${baseMissingMatch[1]})。无法恢复此差异备份。`,
    });
  }

  return normalized;
};
