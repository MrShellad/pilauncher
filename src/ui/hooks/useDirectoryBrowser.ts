// src/ui/hooks/useDirectoryBrowser.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface DirNode {
    name: string;
    path: string;
    is_drive: boolean;
}

export function useDirectoryBrowser(isOpen: boolean, initialPath?: string) {
    // === 核心路径与列表状态 ===
    const [currentPath, setCurrentPath] = useState<string>('');
    const [nodes, setNodes] = useState<DirNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // === 新建目录相关的业务状态 ===
    const [isCreating, setIsCreating] = useState(false);
    const [newDirName, setNewDirName] = useState('PiLauncher');

    // 初始化路径
    useEffect(() => {
        if (isOpen) {
            setCurrentPath(initialPath || '');
            // 每次打开时重置创建状态
            setIsCreating(false);
            setNewDirName('PiLauncher');
        }
    }, [isOpen, initialPath]);

    // 加载目录内容
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const loadDirectory = async () => {
            setLoading(true);
            setError(null);
            try {
                let dirs: DirNode[] = [];
                if (!currentPath) {
                    // 如果没有路径，获取驱动器列表 (根节点)
                    dirs = await invoke<DirNode[]>('get_drives');
                } else {
                    // 否则获取当前路径下的有效子目录
                    dirs = await invoke<DirNode[]>('list_valid_dirs', { path: currentPath });
                }
                if (isMounted) setNodes(dirs);
            } catch (e: any) {
                if (isMounted) {
                    setError(String(e));
                    setNodes([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadDirectory();
        return () => {
            isMounted = false; // 清理函数：防止快速切换路径导致的竞态状态更新
        };
    }, [isOpen, currentPath]);

    // === 导航动作 ===

    // 返回上一级
    const goUp = useCallback(async () => {
        if (!currentPath) return;
        try {
            const parent = await invoke<string | null>('get_parent_dir', { path: currentPath });
            setCurrentPath(parent || '');
        } catch (e) {
            console.warn('Failed to go up directory:', e);
            // 可选：在这里处理无法返回上一级的错误，通常到达根目录返回 null/空即可
        }
    }, [currentPath]);

    // 直接跳转到指定路径
    const goToPath = useCallback((path: string) => {
        setCurrentPath(path);
    }, []);

    // === 创建目录动作 ===

    // 内部：调用 Tauri 接口创建目录
    const createDir = useCallback(async (name: string): Promise<boolean> => {
        if (!name.trim()) return false;
        try {
            const newPath = await invoke<string>('create_valid_dir', { parent: currentPath, name: name.trim() });
            setCurrentPath(newPath); // 创建成功后自动进入新目录
            return true;
        } catch (e: any) {
            setError(String(e));
            return false;
        }
    }, [currentPath]);

    // 供 UI 调用的极简方法
    const startCreating = useCallback(() => {
        setIsCreating(true);
    }, []);

    const cancelCreating = useCallback(() => {
        setIsCreating(false);
        setNewDirName('PiLauncher'); // 恢复默认名称
        setError(null); // 清除可能存在的错误提示
    }, []);

    const confirmCreateDir = useCallback(async () => {
        const success = await createDir(newDirName);
        if (success) {
            setIsCreating(false);
            setNewDirName('PiLauncher'); // 重置默认名称，为下次打开做准备
        }
        return success;
    }, [createDir, newDirName]);

    return {
        // 数据状态
        currentPath,
        nodes,
        loading,
        error,
        isCreating,
        newDirName,

        // 状态更新器
        setNewDirName,

        // 动作方法
        goUp,
        goToPath,
        startCreating,
        cancelCreating,
        confirmCreateDir,
    };
}