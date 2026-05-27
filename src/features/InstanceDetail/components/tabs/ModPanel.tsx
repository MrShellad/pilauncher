import React, { useCallback, useState } from 'react';

import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';

import { ModList } from './mods/components/list/ModList';
import { ModPanelDialogs } from './mods/components/dialogs/ModPanelDialogs';
import { ModPanelTopBar } from './mods/components/panel/ModPanelTopBar';
import { useModPanelController } from './mods/hooks/useModPanelController';
import { useModPanelFocusNavigation } from './mods/hooks/useModPanelFocusNavigation';
import { FavoritePlaceholderModal } from '../../../Download/components/FavoritePlaceholderModal';
import { resolveInstanceGameVersion, resolveInstanceLoader } from '../../logic/modService';
import mcvData from '../../../../assets/download/mcv.json';
import { fetchModrinthProjectById, matchModrinthVersionsByHashes, searchModrinth } from '../../logic/modrinthApi';
import { getCurseForgeProjectDetails, matchCurseForgeFingerprints, hasCurseForgeApiKey, searchCurseForge } from '../../../Download/logic/curseforgeApi';
import { useToastStore } from '../../../../store/useToastStore';

const FALLBACK_MC_VERSIONS: string[] = Array.isArray(mcvData)
  ? mcvData
  : (mcvData as { versions?: string[] }).versions || [];

const MC_VERSION_OPTIONS = FALLBACK_MC_VERSIONS.map((version) => ({ label: version, value: version }));

const isProjectMatching = (hit: any, modId: string, name?: string): boolean => {
  const hitSlug = (hit.slug || '').toLowerCase();
  const hitId = (hit.id || '').toLowerCase();
  const hitTitle = (hit.title || '').toLowerCase();
  
  const cleanModId = modId.toLowerCase();
  const cleanName = (name || '').toLowerCase();

  if (cleanModId) {
    if (hitSlug === cleanModId || hitId === cleanModId) return true;
    if (hitSlug.replace(/[-_]/g, '') === cleanModId.replace(/[-_]/g, '')) return true;
  }
  
  if (cleanName) {
    if (hitTitle === cleanName) return true;
    if (hitTitle.replace(/\s+/g, '') === cleanName.replace(/\s+/g, '')) return true;
  }

  if (cleanModId && (hitSlug.includes(cleanModId) || cleanModId.includes(hitSlug))) return true;
  if (cleanName && (hitTitle.includes(cleanName) || cleanName.includes(hitTitle))) return true;

  return false;
};

const resolveRealProject = async (mod: any): Promise<any | null> => {
  // 1. Already has networkInfo
  if (mod.networkInfo) {
    return {
      ...mod.networkInfo,
      source: mod.networkInfo.source || mod.manifestEntry?.source?.platform || 'modrinth'
    };
  }

  // 2. Has download platform/projectId
  const platform = mod.manifestEntry?.source?.platform;
  const projectId = mod.manifestEntry?.source?.projectId;
  if (platform && projectId) {
    try {
      if (platform === 'modrinth') {
        const detail = await fetchModrinthProjectById(projectId);
        if (detail) return { ...detail, source: 'modrinth' };
      } else if (platform === 'curseforge') {
        const detail = await getCurseForgeProjectDetails(projectId);
        if (detail) return { ...detail, source: 'curseforge' };
      }
    } catch (e) {
      console.error('Failed to fetch details for project ID:', projectId, e);
    }
  }

  // 3. Modrinth SHA1 match
  const sha1 = mod.manifestEntry?.hash?.algorithm?.toLowerCase() === 'sha1'
    ? mod.manifestEntry.hash.value
    : undefined;
  if (sha1) {
    try {
      const modrinthMatches = await matchModrinthVersionsByHashes([sha1], 'sha1');
      const version = modrinthMatches[sha1];
      if (version?.project_id) {
        const detail = await fetchModrinthProjectById(version.project_id);
        if (detail) return { ...detail, source: 'modrinth' };
      }
    } catch (e) {
      console.error('Modrinth reverse search failed', e);
    }
  }

  // 4. CurseForge Fingerprint match
  const fingerprint = typeof mod.curseforgeFingerprint === 'number'
    ? mod.curseforgeFingerprint
    : mod.manifestEntry?.curseforgeFingerprint;
  if (typeof fingerprint === 'number' && hasCurseForgeApiKey()) {
    try {
      const curseForgeMatches = await matchCurseForgeFingerprints([fingerprint]);
      const version = curseForgeMatches[fingerprint];
      if (version?.project_id) {
        const detail = await getCurseForgeProjectDetails(version.project_id);
        if (detail) return { ...detail, source: 'curseforge' };
      }
    } catch (e) {
      console.error('CurseForge reverse search failed', e);
    }
  }

  // 5. Fallback search by modId / name / fileName
  const cleanFileName = mod.fileName
    .replace(/\.disabled$/, '')
    .replace(/\.jar$/, '')
    .split(/[-_]/)[0]
    .trim();

  const searchQueries = [mod.modId, mod.name, cleanFileName].filter(
    (q): q is string => typeof q === 'string' && q.trim().length > 0
  );

  for (const query of searchQueries) {
    // Try Modrinth search
    try {
      const results = await searchModrinth({ query, limit: 5 });
      const matched = results.hits.find((hit) =>
        isProjectMatching(hit, mod.modId || '', mod.name)
      );
      if (matched) return { ...matched, source: 'modrinth' };
    } catch (e) {
      console.error('Modrinth search fallback failed for query:', query, e);
    }

    // Try CurseForge search
    if (hasCurseForgeApiKey()) {
      try {
        const results = await searchCurseForge({ query, limit: 5 });
        const matched = results.hits.find((hit) =>
          isProjectMatching(hit, mod.modId || '', mod.name)
        );
        if (matched) return { ...matched, source: 'curseforge' };
      } catch (e) {
        console.error('CurseForge search fallback failed for query:', query, e);
      }
    }
  }

  // Last resort: if still no match but we have hits, return the first hit if query is modId
  if (mod.modId) {
    try {
      const results = await searchModrinth({ query: mod.modId, limit: 1 });
      if (results.hits.length > 0) {
        return { ...results.hits[0], source: 'modrinth' };
      }
    } catch {}

    if (hasCurseForgeApiKey()) {
      try {
        const results = await searchCurseForge({ query: mod.modId, limit: 1 });
        if (results.hits.length > 0) {
          return { ...results.hits[0], source: 'curseforge' };
        }
      } catch {}
    }
  }

  return null;
};

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const controller = useModPanelController(instanceId);
  const focusNavigation = useModPanelFocusNavigation(controller.state.isBatchMode);
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false);
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const [favoriteProjects, setFavoriteProjects] = useState<any[]>([]);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const handleBatchFavorite = useCallback(async () => {
    if (isIdentifying) return;
    const selectedList = controller.state.mods.filter((mod) =>
      controller.state.selectedMods.has(mod.fileName)
    );

    if (selectedList.length === 0) return;

    setIsIdentifying(true);
    addToast('info', '正在识别模组网络数据，请稍候...');

    try {
      const resolvedProjects: any[] = [];
      let failCount = 0;

      await Promise.all(selectedList.map(async (mod) => {
        const project = await resolveRealProject(mod);
        if (project) {
          resolvedProjects.push(project);
        } else {
          failCount++;
        }
      }));

      if (resolvedProjects.length === 0) {
        addToast('error', '所选模组均无法在 CurseForge 或 Modrinth 上找到匹配项目，禁止收藏。');
      } else {
        if (failCount > 0) {
          addToast('warning', `成功识别了 ${resolvedProjects.length} 个模组，有 ${failCount} 个本地未知模组由于无法匹配到真实数据而被忽略。`);
        } else {
          addToast('success', '模组识别成功，即将加入收藏。');
        }
        setFavoriteProjects(resolvedProjects);
        setIsFavoriteModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      addToast('error', '识别模组元数据失败，请重试');
    } finally {
      setIsIdentifying(false);
    }
  }, [controller.state.mods, controller.state.selectedMods, isIdentifying, addToast]);

  const handleSingleFavorite = useCallback(async (mod: any) => {
    if (isIdentifying) return;
    setIsIdentifying(true);
    addToast('info', '正在识别模组网络数据，请稍候...');

    try {
      const project = await resolveRealProject(mod);
      if (project) {
        addToast('success', '模组识别成功，即将加入收藏。');
        setFavoriteProjects([project]);
        setIsFavoriteModalOpen(true);
      } else {
        addToast('error', '该模组无法在 CurseForge 或 Modrinth 上找到匹配项目，禁止收藏本地未知模组。');
      }
    } catch (e) {
      console.error(e);
      addToast('error', '识别模组元数据失败，请重试');
    } finally {
      setIsIdentifying(false);
    }
  }, [isIdentifying, addToast]);

  const handleTopBarCollapseChange = useCallback((collapsed: boolean) => {
    setIsTopBarCollapsed((current) => (current === collapsed ? current : collapsed));
  }, []);

  return (
    <SettingsPageLayout
      width="wide"
      scrollable={false}
      className="[&_.ore-settings-page-layout__content]:gap-2"
    >
      <ModPanelTopBar
        {...controller.topBar}
        isCollapsed={isTopBarCollapsed}
        onArrowPress={focusNavigation.handleTopBarArrow}
      />

      <ModList
        {...controller.list}
        onBatchFavorite={handleBatchFavorite}
        onTopBarCollapseChange={handleTopBarCollapseChange}
        onHeaderArrowPress={focusNavigation.handleTopBarArrow}
        onNavigateOut={focusNavigation.handleListNavigateOut}
      />

      <ModPanelDialogs
        instanceConfig={controller.state.instanceConfig}
        mods={controller.state.mods}
        snapshotState={controller.state.snapshotState}
        state={controller.dialogs.state}
        actions={controller.dialogs.actions}
        onInstallVersion={controller.modActions.onInstallVersion}
        onSaveMetadataSettings={controller.modActions.onSaveMetadataSettings}
        onReidentifyMod={controller.modActions.onReidentifyMod}
        onMetadataResolved={controller.modActions.onMetadataResolved}
        onSaveGlobalMetadataSettings={controller.dialogs.actions.onSaveGlobalMetadataSettings}
        onReidentifyAllMods={controller.dialogs.actions.onReidentifyAllMods}
        onAddFavorite={handleSingleFavorite}
      />

      <OreConfirmDialog
        isOpen={controller.cleanupDialog.isOpen}
        onClose={controller.cleanupDialog.onClose}
        onConfirm={controller.cleanupDialog.onConfirm}
        title={controller.cleanupDialog.title}
        headline={controller.cleanupDialog.headline}
        confirmLabel={controller.cleanupDialog.confirmLabel}
        cancelLabel={controller.cleanupDialog.cancelLabel}
        confirmVariant="primary"
        confirmFocusKey="mod-cleanup-confirm"
        cancelFocusKey="mod-cleanup-cancel"
        className="w-full max-w-2xl"
      >
        <div className="mt-4 max-h-64 overflow-y-auto rounded bg-[#18181B] p-2 text-left text-sm text-gray-300">
          {controller.cleanupDialog.items?.map((item, index) => (
            <div key={`${item.originalFileName}-${index}`} className="mb-2 border-b border-[#2A2A2C] pb-2 last:border-0 last:pb-0">
              <div className="line-through opacity-80 text-red-400">{item.originalFileName}</div>
              <div className="text-ore-green">{item.suggestedFileName}</div>
            </div>
          ))}
        </div>
      </OreConfirmDialog>

      <OreConfirmDialog
        isOpen={controller.upgradeSnapshotDialog.isOpen}
        onClose={controller.upgradeSnapshotDialog.onClose}
        onConfirm={controller.upgradeSnapshotDialog.onConfirm}
        title={`${controller.upgradeSnapshotDialog.actionLabel}前创建快照`}
        headline="建议先记录当前模组状态"
        description={
          controller.upgradeSnapshotDialog.mod
            ? `首次${controller.upgradeSnapshotDialog.actionLabel}模组前，可以创建一个快照，之后如果版本不稳定，可在历史快照中快速回退。即将${controller.upgradeSnapshotDialog.actionLabel}：${controller.upgradeSnapshotDialog.mod.fileName}`
            : undefined
        }
        confirmLabel={controller.upgradeSnapshotDialog.isCreatingSnapshot ? '创建中...' : `创建快照并${controller.upgradeSnapshotDialog.actionLabel}`}
        cancelLabel="取消"
        confirmVariant="primary"
        tone="warning"
        confirmFocusKey="mod-upgrade-snapshot-confirm"
        cancelFocusKey="mod-upgrade-snapshot-cancel"
        isConfirming={controller.upgradeSnapshotDialog.isCreatingSnapshot}
        closeOnOutsideClick={!controller.upgradeSnapshotDialog.isCreatingSnapshot}
        className="w-full max-w-2xl"
        confirmationNote={`这个提示只会在本实例本次进入页面后的第一次${controller.upgradeSnapshotDialog.actionLabel}时出现。`}
        confirmationNoteTone="info"
        tertiaryAction={{
          label: `直接${controller.upgradeSnapshotDialog.actionLabel}`,
          onClick: controller.upgradeSnapshotDialog.onSkip,
          variant: 'secondary',
          focusKey: 'mod-upgrade-snapshot-skip',
          disabled: controller.upgradeSnapshotDialog.isCreatingSnapshot
        }}
      />
       <FavoritePlaceholderModal
        isOpen={isFavoriteModalOpen}
        projects={favoriteProjects}
        onClose={() => setIsFavoriteModalOpen(false)}
        resourceType="mod"
        defaultGameVersion={resolveInstanceGameVersion(controller.state.instanceConfig)}
        defaultLoader={resolveInstanceLoader(controller.state.instanceConfig)}
        mcVersionOptions={MC_VERSION_OPTIONS}
        onCreated={() => {
          controller.list.onExitBatchMode();
        }}
      />
    </SettingsPageLayout>
  );
};
