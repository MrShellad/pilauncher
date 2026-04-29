import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface DirNode {
  name: string;
  path: string;
  is_drive: boolean;
  is_file?: boolean;
  extension?: string | null;
}

interface DirectoryBrowserOptions {
  showFiles?: boolean;
  allowedExtensions?: string[];
}

const normalizeExtensions = (extensions?: string[]) =>
  new Set((extensions || []).map((extension) => extension.replace(/^\./, '').toLowerCase()));

export function useDirectoryBrowser(
  isOpen: boolean,
  initialPath?: string,
  options: DirectoryBrowserOptions = {},
) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [nodes, setNodes] = useState<DirNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [newDirName, setNewDirName] = useState('PiLauncher');

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPath(initialPath || '');
    setBackStack([]);
    setForwardStack([]);
    setIsCreating(false);
    setNewDirName('PiLauncher');
  }, [isOpen, initialPath]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadDirectory = async () => {
      setLoading(true);
      setError(null);
      try {
        let nextNodes: DirNode[] = [];
        if (!currentPath) {
          nextNodes = await invoke<DirNode[]>('get_drives');
        } else if (options.showFiles) {
          const allNodes = await invoke<DirNode[]>('list_directory_entries', {
            path: currentPath,
            includeFiles: true,
          });
          const allowedExtensions = normalizeExtensions(options.allowedExtensions);
          nextNodes =
            allowedExtensions.size === 0
              ? allNodes
              : allNodes.filter(
                  (node) =>
                    !node.is_file ||
                    (node.extension && allowedExtensions.has(node.extension.toLowerCase())),
                );
        } else {
          nextNodes = await invoke<DirNode[]>('list_valid_dirs', { path: currentPath });
        }

        if (isMounted) setNodes(nextNodes);
      } catch (e: any) {
        if (isMounted) {
          setError(String(e));
          setNodes([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadDirectory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentPath, options.showFiles, options.allowedExtensions]);

  const navigateToPath = useCallback((path: string) => {
    setCurrentPath((previous) => {
      if (previous === path) return previous;
      setBackStack((stack) => [...stack, previous]);
      setForwardStack([]);
      return path;
    });
  }, []);

  const goUp = useCallback(async () => {
    if (!currentPath) return;
    try {
      const parent = await invoke<string | null>('get_parent_dir', { path: currentPath });
      navigateToPath(parent || '');
    } catch (e) {
      console.warn('Failed to go up directory:', e);
    }
  }, [currentPath, navigateToPath]);

  const goToPath = useCallback((path: string) => {
    navigateToPath(path);
  }, [navigateToPath]);

  const goBack = useCallback(() => {
    setBackStack((stack) => {
      if (stack.length === 0) return stack;
      const nextStack = stack.slice(0, -1);
      const target = stack[stack.length - 1];
      setCurrentPath((current) => {
        setForwardStack((forward) => [current, ...forward]);
        return target;
      });
      return nextStack;
    });
  }, []);

  const goForward = useCallback(() => {
    setForwardStack((stack) => {
      if (stack.length === 0) return stack;
      const [target, ...nextStack] = stack;
      setCurrentPath((current) => {
        setBackStack((back) => [...back, current]);
        return target;
      });
      return nextStack;
    });
  }, []);

  const createDir = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    try {
      const newPath = await invoke<string>('create_valid_dir', {
        parent: currentPath,
        name: name.trim(),
      });
      navigateToPath(newPath);
      return true;
    } catch (e: any) {
      setError(String(e));
      return false;
    }
  }, [currentPath, navigateToPath]);

  const startCreating = useCallback(() => {
    setIsCreating(true);
  }, []);

  const cancelCreating = useCallback(() => {
    setIsCreating(false);
    setNewDirName('PiLauncher');
    setError(null);
  }, []);

  const confirmCreateDir = useCallback(async () => {
    const success = await createDir(newDirName);
    if (success) {
      setIsCreating(false);
      setNewDirName('PiLauncher');
    }
    return success;
  }, [createDir, newDirName]);

  return {
    currentPath,
    nodes,
    loading,
    error,
    isCreating,
    newDirName,
    setNewDirName,
    goUp,
    goToPath,
    goBack,
    goForward,
    canGoBack: backStack.length > 0,
    canGoForward: forwardStack.length > 0,
    startCreating,
    cancelCreating,
    confirmCreateDir,
  };
}
