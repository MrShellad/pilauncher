import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { useDownloadStore } from '../../../store/useDownloadStore';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useSettingsStore } from '../../../store/useSettingsStore';

const MAX_IMPORT_LOGS = 200;

export interface MissingRuntime {
  instance_id: string;
  mc_version: string;
  loader_type: string;
  loader_version: string;
}

export interface ThirdPartyImportInstance {
  id: string;
  name: string;
  path: string;
  versionJsonPath: string;
  mcVersion: string;
  loaderType: string;
  loaderVersion: string;
  status: 'importable' | 'already_imported' | 'name_conflict' | 'imported';
}

export interface ThirdPartyImportSource {
  sourcePath: string;
  rootPath: string;
  versionsPath: string;
  sourceKind: 'minecraft_root' | 'versions_dir' | 'instance_dir';
  sourceLabel: string;
  launcherHint: string;
  hasAssets: boolean;
  hasLibraries: boolean;
  instanceCount: number;
  importableCount: number;
  alreadyImportedCount: number;
  conflictCount: number;
  instances: ThirdPartyImportInstance[];
}

export interface ThirdPartyImportFailure {
  instanceId: string;
  path: string;
  reason: string;
}

export interface ThirdPartyImportResult {
  sourcePath: string;
  rootPath: string;
  sourceKind: ThirdPartyImportSource['sourceKind'];
  added: number;
  skipped: number;
  failed: number;
  missing: MissingRuntime[];
  importedInstances: ThirdPartyImportInstance[];
  skippedInstances: ThirdPartyImportInstance[];
  failedInstances: ThirdPartyImportFailure[];
}

export interface ThirdPartyImportProgressEvent {
  sourcePath: string;
  phase: string;
  level: 'info' | 'success' | 'warning' | 'error';
  current: number;
  total: number;
  message: string;
  instanceId?: string | null;
}

export interface ImportLogEntry {
  id: string;
  phase: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  current: number;
  total: number;
  instanceId?: string | null;
  timestamp: string;
}

export interface ImportState {
  isOpen: boolean;
  status: 'idle' | 'importing' | 'success' | 'partial_missing' | 'error' | 'empty';
  sourcePath: string;
  sourceLabel: string;
  progressPhase: string;
  progressCurrent: number;
  progressTotal: number;
  currentMessage: string;
  logs: ImportLogEntry[];
  added: number;
  skipped: number;
  failed: number;
  missing: MissingRuntime[];
  importedInstances: ThirdPartyImportInstance[];
  skippedInstances: ThirdPartyImportInstance[];
  failedInstances: ThirdPartyImportFailure[];
  errorMsg: string;
}

const createInitialImportState = (): ImportState => ({
  isOpen: false,
  status: 'idle',
  sourcePath: '',
  sourceLabel: '',
  progressPhase: '',
  progressCurrent: 0,
  progressTotal: 0,
  currentMessage: '',
  logs: [],
  added: 0,
  skipped: 0,
  failed: 0,
  missing: [],
  importedInstances: [],
  skippedInstances: [],
  failedInstances: [],
  errorMsg: '',
});

const appendImportLog = (
  logs: ImportLogEntry[],
  entry: Omit<ImportLogEntry, 'id'>
): ImportLogEntry[] => {
  const nextEntry: ImportLogEntry = {
    ...entry,
    id: `${Date.now()}-${logs.length}-${entry.phase}-${entry.level}`,
  };

  return [...logs, nextEntry].slice(-MAX_IMPORT_LOGS);
};

const toImportLogEntry = (payload: ThirdPartyImportProgressEvent): Omit<ImportLogEntry, 'id'> => ({
  phase: payload.phase,
  level: payload.level,
  message: payload.message,
  current: payload.current,
  total: payload.total,
  instanceId: payload.instanceId,
  timestamp: new Date().toISOString(),
});

const sortImportSources = (sources: ThirdPartyImportSource[]) =>
  [...sources].sort((left, right) => {
    if (right.importableCount !== left.importableCount) {
      return right.importableCount - left.importableCount;
    }

    if (right.instanceCount !== left.instanceCount) {
      return right.instanceCount - left.instanceCount;
    }

    return left.sourcePath.localeCompare(right.sourcePath);
  });

const mergeImportSources = (
  previous: ThirdPartyImportSource[],
  incoming: ThirdPartyImportSource[]
) => {
  const sourceMap = new Map(previous.map((item) => [item.sourcePath, item]));
  incoming.forEach((item) => sourceMap.set(item.sourcePath, item));
  return sortImportSources(Array.from(sourceMap.values()));
};

interface UseThirdPartyImportProps {
  onImportSuccess?: () => void | Promise<void>;
}

export const useThirdPartyImport = ({ onImportSuccess }: UseThirdPartyImportProps = {}) => {
  const [importSources, setImportSources] = useState<ThirdPartyImportSource[]>([]);
  const [isDetectingSources, setIsDetectingSources] = useState(false);
  const [importState, setImportState] = useState<ImportState>(createInitialImportState);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const activeImportSourceRef = useRef<string | null>(null);
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);

  const refreshImportSources = useCallback(async () => {
    setIsPanelOpen(true);
    setIsDetectingSources(true);

    try {
      const detectedSources = await invoke<ThirdPartyImportSource[]>(
        'detect_third_party_launcher_sources'
      );

      const trackedPaths = useSettingsStore.getState().settings.general.thirdPartyDirs || [];
      const knownSourcePaths = new Set(detectedSources.map((item) => item.sourcePath));

      const trackedResults = await Promise.all(
        trackedPaths
          .filter((path) => !knownSourcePaths.has(path))
          .map((path) =>
            invoke<ThirdPartyImportSource[]>('detect_third_party_launcher_sources', { path }).catch(
              () => []
            )
          )
      );

      setImportSources(
        sortImportSources([...detectedSources, ...trackedResults.flat()])
      );
    } catch (error) {
      console.error('自动探测第三方启动器库失败:', error);
    } finally {
      setIsDetectingSources(false);
    }
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<ThirdPartyImportProgressEvent>(
      'third-party-import-progress',
      (event) => {
        const payload = event.payload;
        const activeSourcePath = activeImportSourceRef.current;

        if (activeSourcePath && payload.sourcePath !== activeSourcePath) {
          return;
        }

        setImportState((currentState) => {
          if (!currentState.isOpen) {
            return currentState;
          }

          return {
            ...currentState,
            progressPhase: payload.phase,
            progressCurrent: payload.current,
            progressTotal: payload.total,
            currentMessage: payload.message,
            logs: appendImportLog(currentState.logs, toImportLogEntry(payload)),
          };
        });
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const closeImportModal = () => {
    setImportState((currentState) =>
      currentState.status === 'importing'
        ? currentState
        : { ...currentState, isOpen: false }
    );
  };

  const confirmDownloadMissing = async () => {
    const missingList = importState.missing;
    closeImportModal();
    setActiveTab('home');
    useDownloadStore.getState().setPopupOpen(true);
    await invoke('download_missing_runtimes', { missingList });
  };

  const inspectThirdPartySource = useCallback(async (path: string) => {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return;
    }

    setIsPanelOpen(true);
    setIsDetectingSources(true);

    try {
      const detectedSources = await invoke<ThirdPartyImportSource[]>(
        'detect_third_party_launcher_sources',
        { path: trimmedPath }
      );

      if (detectedSources.length === 0) {
        setIsPanelOpen(false);
        setImportState({
          ...createInitialImportState(),
          isOpen: true,
          status: 'empty',
          sourcePath: trimmedPath,
          sourceLabel: '手动选择',
          currentMessage: '该目录中没有识别到可导入的 PCL/HMCL 类实例。',
          errorMsg:
            '请选择 .minecraft、versions，或包含 {版本名}.json 的独立实例目录。',
        });
        return;
      }

      setImportSources((currentSources) => mergeImportSources(currentSources, detectedSources));
    } catch (error) {
      console.error('手动识别第三方启动器库失败:', error);
      setIsPanelOpen(false);
      setImportState({
        ...createInitialImportState(),
        isOpen: true,
        status: 'error',
        sourcePath: trimmedPath,
        sourceLabel: '手动选择',
        currentMessage: '目录识别失败。',
        errorMsg: String(error),
      });
    } finally {
      setIsDetectingSources(false);
    }
  }, []);

  const handleImportSource = useCallback(
    async (source: ThirdPartyImportSource) => {
      activeImportSourceRef.current = source.sourcePath;

      setImportState({
        ...createInitialImportState(),
        isOpen: true,
        status: 'importing',
        sourcePath: source.sourcePath,
        sourceLabel: source.sourceLabel,
        progressPhase: 'PREPARING',
        progressCurrent: 0,
        progressTotal: Math.max(source.instanceCount, 1),
        currentMessage: `准备导入 ${source.instanceCount} 个实例...`,
        logs: appendImportLog([], {
          phase: 'PREPARING',
          level: 'info',
          message: `开始处理 ${source.sourceLabel}`,
          current: 0,
          total: Math.max(source.instanceCount, 1),
          timestamp: new Date().toISOString(),
        }),
      });

      try {
        const result = await invoke<ThirdPartyImportResult>(
          'import_third_party_launcher_source',
          { path: source.sourcePath }
        );

        const associationPath = source.rootPath || source.sourcePath;
        const { settings, updateGeneralSetting } = useSettingsStore.getState();
        const currentDirs = settings.general.thirdPartyDirs || [];

        if (!currentDirs.includes(associationPath)) {
          updateGeneralSetting('thirdPartyDirs', [...currentDirs, associationPath]);
        }

        const promises: Promise<any>[] = [refreshImportSources()];
        if (onImportSuccess) {
          promises.push(Promise.resolve(onImportSuccess()));
        }
        await Promise.all(promises);

        setImportState((currentState) => {
          const nextStatus: ImportState['status'] =
            result.added === 0 && result.failed > 0
              ? 'error'
              : result.added === 0 && result.skipped === 0
                ? 'empty'
                : result.missing.length > 0
                  ? 'partial_missing'
                  : 'success';

          return {
            ...currentState,
            status: nextStatus,
            sourcePath: result.sourcePath,
            progressPhase: 'DONE',
            progressCurrent: currentState.progressTotal || Math.max(source.instanceCount, 1),
            progressTotal: currentState.progressTotal || Math.max(source.instanceCount, 1),
            currentMessage: `导入结束：新增 ${result.added}，跳过 ${result.skipped}，失败 ${result.failed}。`,
            added: result.added,
            skipped: result.skipped,
            failed: result.failed,
            missing: result.missing,
            importedInstances: result.importedInstances,
            skippedInstances: result.skippedInstances,
            failedInstances: result.failedInstances,
            errorMsg:
              result.failed > 0 && result.added === 0
                ? result.failedInstances[0]?.reason || '导入过程中出现错误。'
                : currentState.errorMsg,
          };
        });
      } catch (error) {
        console.error('导入第三方启动器实例失败:', error);
        setImportState((currentState) => ({
          ...currentState,
          status: 'error',
          currentMessage: '导入失败。',
          errorMsg: String(error),
          logs: appendImportLog(currentState.logs, {
            phase: 'FAILED',
            level: 'error',
            message: String(error),
            current: currentState.progressCurrent,
            total: currentState.progressTotal,
            timestamp: new Date().toISOString(),
          }),
        }));
      } finally {
        activeImportSourceRef.current = null;
      }
    },
    [refreshImportSources, onImportSuccess]
  );

  return {
    isPanelOpen,
    setIsPanelOpen,
    importSources,
    isDetectingSources,
    importState,
    isImporting: importState.status === 'importing',
    closeImportModal,
    confirmDownloadMissing,
    refreshImportSources,
    inspectThirdPartySource,
    handleImportSource,
  };
};
