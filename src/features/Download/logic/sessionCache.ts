import { invoke } from '@tauri-apps/api/core';

export const readSessionCache = async <T>(namespace: string): Promise<T | null> => {
  try {
    return await invoke<T | null>('read_session_cache', { namespace });
  } catch (error) {
    console.error(`读取会话缓存失败 [${namespace}]`, error);
    return null;
  }
};

export const writeSessionCache = async <T>(namespace: string, data: T): Promise<void> => {
  try {
    await invoke('write_session_cache', { namespace, data });
  } catch (error) {
    console.error(`写入会话缓存失败 [${namespace}]`, error);
  }
};

export const readPersistentCache = async <T>(namespace: string): Promise<T | null> => {
  try {
    return await invoke<T | null>('read_persistent_cache', { namespace });
  } catch (error) {
    console.error(`读取持久缓存失败 [${namespace}]`, error);
    return null;
  }
};

export const writePersistentCache = async <T>(namespace: string, data: T): Promise<void> => {
  try {
    await invoke('write_persistent_cache', { namespace, data });
  } catch (error) {
    console.error(`写入持久缓存失败 [${namespace}]`, error);
  }
};
