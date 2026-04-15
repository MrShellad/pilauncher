import type { TFunction } from 'i18next';
import type { InstanceSnapshot, ModEntry, ModMeta, SnapshotDiff } from '../../../../logic/modService';

export type SnapshotModEntry = InstanceSnapshot['mods'][number];

export const resolveEnabledState = (mod: SnapshotModEntry) => mod.isEnabled ?? !mod.fileName.endsWith('.disabled');

export const getDisplayFileName = (mod: SnapshotModEntry) => mod.fileName.replace(/\.disabled$/i, '');

/**
 * Compute a client-side diff between the live mod list and a target snapshot.
 * This compares what is currently on disk vs what the snapshot recorded.
 */
export const computeRollbackDiff = (liveMods: ModMeta[], targetMods: ModEntry[]): SnapshotDiff => {
  // Build maps keyed by normalised filename (without .disabled suffix)
  const normaliseName = (name: string) => name.replace(/\.disabled$/i, '');

  const liveByName = new Map<string, ModMeta>();
  for (const m of liveMods) {
    liveByName.set(normaliseName(m.fileName), m);
  }

  const targetByName = new Map<string, ModEntry>();
  for (const m of targetMods) {
    targetByName.set(normaliseName(m.fileName), m);
  }

  const added: ModEntry[] = [];      // in target but not in live → will be restored
  const removed: ModEntry[] = [];    // in live but not in target → will be removed
  const updated: { old: ModEntry; new: ModEntry }[] = [];       // same name, different hash
  const stateChanged: { old: ModEntry; new: ModEntry }[] = [];  // same file, different enabled state

  // Mods that exist in live but not in target → will be removed
  for (const [name, liveMod] of liveByName) {
    if (!targetByName.has(name)) {
      removed.push({
        hash: '',
        fileName: liveMod.fileName,
        modId: liveMod.modId,
        version: liveMod.version,
        isEnabled: liveMod.isEnabled
      });
    }
  }

  // Mods in target
  for (const [name, targetMod] of targetByName) {
    const liveMod = liveByName.get(name);
    if (!liveMod) {
      // In target but not in live → will be restored
      added.push(targetMod);
    } else {
      // Both exist — check for content changes or state changes
      const liveEnabled = liveMod.isEnabled;
      const targetEnabled = targetMod.isEnabled ?? !targetMod.fileName.endsWith('.disabled');

      // Compare by manifest hash if available
      const liveHash = liveMod.manifestEntry?.hash?.value || '';
      const targetHash = targetMod.hash || '';
      if (liveHash && targetHash && liveHash !== targetHash) {
        updated.push({
          old: {
            hash: liveHash,
            fileName: liveMod.fileName,
            modId: liveMod.modId,
            version: liveMod.version,
            isEnabled: liveEnabled
          },
          new: targetMod
        });
      } else if (liveEnabled !== targetEnabled) {
        stateChanged.push({
          old: {
            hash: liveHash,
            fileName: liveMod.fileName,
            modId: liveMod.modId,
            version: liveMod.version,
            isEnabled: liveEnabled
          },
          new: targetMod
        });
      }
    }
  }

  return { added, removed, updated, stateChanged };
};

/** Build a consistent version label: Snapshot #N (newest = highest number). */
export const getVersionLabel = (t: TFunction, index: number, total: number) =>
  t('modSnapshots.timeline.snapshotLabel', {
    defaultValue: 'Snapshot #{{index}}',
    index: total - index
  });
