import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';

import {
  LOADER_TYPES,
  type LoaderType,
  type McVersionType,
  VERSION_TYPES,
  type VersionGroup,
} from '../../../../../Instances/logic/environmentSelection';
import { useInputAction } from '../../../../../../ui/focus/InputDriver';
import {
  canApplyEnvironment,
  createEnvironmentUpdate,
  getCurrentEnvironmentState,
  getFirstLoaderFocusKey,
  getFirstVersionFocusKey,
  getCurrentLoaderLabel,
  getFilteredEnvironmentVersionGroups,
  getNextCircularValue,
  getSelectedLoaderVersion,
  getSortedEnvironmentLoaderVersions,
  getTargetLoaderVersion,
  hasEnvironmentChanged,
} from '../utils/environmentSectionUtils';
import type { InstanceEnvironmentUpdate } from '../schemas/basicPanelSchemas';

interface UseEnvironmentSectionOptions {
  currentGameVersion?: string;
  currentLoaderType?: string;
  currentLoaderVersion?: string;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
  onUpdateEnvironment: (update: InstanceEnvironmentUpdate) => Promise<void>;
  onSuccess: (msg: string) => void;
}

export const useEnvironmentSection = ({
  currentGameVersion,
  currentLoaderType,
  currentLoaderVersion,
  isGlobalSaving,
  setIsGlobalSaving,
  onUpdateEnvironment,
  onSuccess,
}: UseEnvironmentSectionOptions) => {
  const {
    currentGameVersionValue,
    normalizedCurrentLoader,
    normalizedCurrentLoaderVersion,
  } = getCurrentEnvironmentState({
    currentGameVersion,
    currentLoaderType,
    currentLoaderVersion,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [gameVersion, setGameVersion] = useState(currentGameVersionValue);
  const [versionType, setVersionType] = useState<McVersionType>('release');
  const [loaderType, setLoaderType] = useState<LoaderType>(normalizedCurrentLoader);
  const [loaderVersion, setLoaderVersion] = useState<string | null>(normalizedCurrentLoaderVersion);
  const [versionGroups, setVersionGroups] = useState<VersionGroup[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingLoaders, setIsLoadingLoaders] = useState(false);
  const [errorText, setErrorText] = useState('');
  const lastContentFocusKeyRef = useRef<string | null>(null);
  const lastListAreaRef = useRef<'versions' | 'loaders'>('versions');
  const pendingLoaderFocusRef = useRef(false);

  const openModal = useCallback(() => setIsOpen(true), []);

  const closeModal = useCallback(() => {
    if (!isGlobalSaving) setIsOpen(false);
  }, [isGlobalSaving]);

  useEffect(() => {
    if (!isOpen) return;
    setGameVersion(currentGameVersionValue);
    setLoaderType(normalizedCurrentLoader);
    setLoaderVersion(normalizedCurrentLoaderVersion);
    setErrorText('');
  }, [isOpen, currentGameVersionValue, normalizedCurrentLoader, normalizedCurrentLoaderVersion]);

  const fetchVersions = useCallback(async (force = false) => {
    try {
      setIsLoadingVersions(true);
      const data = await invoke<VersionGroup[]>('get_minecraft_versions', { force });
      setVersionGroups(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch Minecraft versions:', error);
      setErrorText('获取 Minecraft 版本列表失败');
      return null;
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  const focusWhenAvailable = useCallback((getFocusKey: () => string | null) => {
    let attempts = 0;
    const tryFocus = () => {
      const focusKey = getFocusKey();
      if (focusKey && doesFocusableExist(focusKey)) {
        setFocus(focusKey);
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        window.setTimeout(tryFocus, 60);
      }
    };

    window.setTimeout(tryFocus, 0);
  }, []);

  useEffect(() => {
    if (isOpen && versionGroups.length === 0) {
      void fetchVersions(false);
    }
  }, [fetchVersions, isOpen, versionGroups.length]);

  useEffect(() => {
    if (!isOpen) return;

    if (loaderType === 'Vanilla') {
      setLoaderVersions([]);
      setLoaderVersion('Vanilla');
      setIsLoadingLoaders(false);
      if (pendingLoaderFocusRef.current) {
        pendingLoaderFocusRef.current = false;
        focusWhenAvailable(() => getFirstLoaderFocusKey('Vanilla', []));
      }
      return;
    }

    if (!gameVersion) {
      setLoaderVersions([]);
      setLoaderVersion(null);
      setIsLoadingLoaders(false);
      return;
    }

    let cancelled = false;

    const fetchLoaders = async () => {
      try {
        setIsLoadingLoaders(true);
        setErrorText('');
        const data = await invoke<string[]>('get_loader_versions', {
          loaderType,
          gameVersion,
        });
        if (cancelled) return;

        const sorted = getSortedEnvironmentLoaderVersions(data);
        setLoaderVersions(sorted);
        setLoaderVersion((prev) =>
          getSelectedLoaderVersion({
            previousLoaderVersion: prev,
            sortedLoaderVersions: sorted,
            loaderType,
            normalizedCurrentLoader,
            normalizedCurrentLoaderVersion,
          }),
        );
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch loader versions:', error);
          setLoaderVersions([]);
          setLoaderVersion(null);
          setErrorText('获取 Loader 版本列表失败');
        }
      } finally {
        if (!cancelled) setIsLoadingLoaders(false);
      }
    };

    void fetchLoaders();
    return () => {
      cancelled = true;
    };
  }, [focusWhenAvailable, isOpen, loaderType, gameVersion, normalizedCurrentLoader, normalizedCurrentLoaderVersion]);

  const filteredVersionGroups = useMemo(
    () => getFilteredEnvironmentVersionGroups(versionGroups, versionType),
    [versionGroups, versionType],
  );

  const targetLoaderVersion = getTargetLoaderVersion(loaderType, loaderVersion);
  const environmentChanged = hasEnvironmentChanged({
    gameVersion,
    loaderType,
    targetLoaderVersion,
    currentGameVersionValue,
    normalizedCurrentLoader,
    normalizedCurrentLoaderVersion,
  });

  const canApply = canApplyEnvironment({
    gameVersion,
    loaderType,
    targetLoaderVersion,
    isLoadingVersions,
    isLoadingLoaders,
    hasEnvironmentChanged: environmentChanged,
  });

  const selectLoaderType = useCallback((type: LoaderType) => {
    lastListAreaRef.current = 'loaders';
    pendingLoaderFocusRef.current = true;
    setLoaderType(type);
    if (type === 'Vanilla') setLoaderVersion('Vanilla');
  }, []);

  const focusVersionList = useCallback((groups = filteredVersionGroups) => {
    lastListAreaRef.current = 'versions';
    focusWhenAvailable(() => getFirstVersionFocusKey(groups));
  }, [filteredVersionGroups, focusWhenAvailable]);

  const focusLoaderList = useCallback((
    targetLoaderType = loaderType,
    versions = loaderVersions,
  ) => {
    lastListAreaRef.current = 'loaders';
    focusWhenAvailable(() => getFirstLoaderFocusKey(targetLoaderType, versions));
  }, [focusWhenAvailable, loaderType, loaderVersions]);

  useEffect(() => {
    if (!isOpen || isLoadingLoaders || !pendingLoaderFocusRef.current) return;
    pendingLoaderFocusRef.current = false;
    focusLoaderList();
  }, [focusLoaderList, isLoadingLoaders, isOpen, loaderType, loaderVersions]);

  const selectVersionType = useCallback((type: McVersionType) => {
    setVersionType(type);
    focusVersionList(getFilteredEnvironmentVersionGroups(versionGroups, type));
  }, [focusVersionList, versionGroups]);

  const switchVersionType = useCallback((direction: -1 | 1) => {
    if (!isOpen) return;
    const nextType = getNextCircularValue(VERSION_TYPES, versionType, direction);
    selectVersionType(nextType);
  }, [isOpen, selectVersionType, versionType]);

  const switchLoaderType = useCallback((direction: -1 | 1) => {
    if (!isOpen) return;
    const nextType = getNextCircularValue(LOADER_TYPES, loaderType, direction);
    selectLoaderType(nextType);
  }, [isOpen, loaderType, selectLoaderType]);

  const handleRefreshVersions = useCallback(async (force = true) => {
    const nextGroups = await fetchVersions(force);
    focusVersionList(
      nextGroups
        ? getFilteredEnvironmentVersionGroups(nextGroups, versionType)
        : filteredVersionGroups,
    );
  }, [fetchVersions, filteredVersionGroups, focusVersionList, versionType]);

  const focusActiveList = useCallback(() => {
    if (lastListAreaRef.current === 'loaders') {
      focusLoaderList();
    } else {
      focusVersionList();
    }
  }, [focusLoaderList, focusVersionList]);

  const toggleFooterFocus = useCallback(() => {
    if (!isOpen) return;

    const currentFocusKey = getCurrentFocusKey();
    const isFooterFocused =
      currentFocusKey === 'basic-env-cancel' ||
      currentFocusKey === 'basic-env-apply';

    if (isFooterFocused) {
      if (lastContentFocusKeyRef.current && doesFocusableExist(lastContentFocusKeyRef.current)) {
        setFocus(lastContentFocusKeyRef.current);
        return;
      }

      focusActiveList();
      return;
    }

    if (currentFocusKey) {
      lastContentFocusKeyRef.current = currentFocusKey;
    }

    const footerTarget = canApply ? 'basic-env-apply' : 'basic-env-cancel';
    if (doesFocusableExist(footerTarget)) {
      setFocus(footerTarget);
    }
  }, [canApply, focusActiveList, isOpen]);

  useInputAction('TAB_LEFT', () => switchVersionType(-1));
  useInputAction('TAB_RIGHT', () => switchVersionType(1));
  useInputAction('PAGE_LEFT', () => switchLoaderType(-1));
  useInputAction('PAGE_RIGHT', () => switchLoaderType(1));
  useInputAction('ACTION_X', () => {
    if (isOpen && !isLoadingVersions) void handleRefreshVersions(true);
  });
  useInputAction('ACTION_Y', toggleFooterFocus);

  const handleApply = useCallback(async () => {
    if (!canApply) return;

    try {
      setIsGlobalSaving(true);
      setErrorText('');
      await onUpdateEnvironment(createEnvironmentUpdate(gameVersion, loaderType, targetLoaderVersion));
      setIsOpen(false);
      onSuccess('实例环境已更新');
    } catch (error) {
      console.error('Failed to update instance environment:', error);
      setErrorText(`更新实例环境失败: ${String(error)}`);
    } finally {
      setIsGlobalSaving(false);
    }
  }, [
    canApply,
    gameVersion,
    loaderType,
    onSuccess,
    onUpdateEnvironment,
    setIsGlobalSaving,
    targetLoaderVersion,
  ]);

  const currentLoaderLabel = getCurrentLoaderLabel(
    normalizedCurrentLoader,
    normalizedCurrentLoaderVersion,
  );

  return {
    normalizedCurrentLoader,
    currentLoaderLabel,
    isOpen,
    openModal,
    closeModal,
    gameVersion,
    setGameVersion,
    versionType,
    selectVersionType,
    loaderType,
    selectLoaderType,
    loaderVersion,
    setLoaderVersion,
    filteredVersionGroups,
    loaderVersions,
    isLoadingVersions,
    isLoadingLoaders,
    errorText,
    canApply,
    handleApply,
    refreshVersions: handleRefreshVersions,
    focusVersionList,
    focusLoaderList,
  };
};
