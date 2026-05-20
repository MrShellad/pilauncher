import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type { 
  TerracottaSnapshot, 
  CreateRoomInput, 
  JoinRoomInput,
  TerracottaStatePayload,
  TerracottaLogEntry
} from '../types';

export const useTerracottaSession = () => {
  const [snapshot, setSnapshot] = useState<TerracottaSnapshot>({
    lifecycle: 'idle',
    role: null,
    logs: [],
    isBusy: false,
    busyLabel: null,
    roomCode: null,
    lastError: null,
    isInstalled: null, // null = still checking
    downloadStatus: 'idle',
    downloadUrl: null
  });

  // Check if Terracotta binary is installed on mount
  useEffect(() => {
    invoke<boolean>('check_terracotta_installed').then(installed => {
      setSnapshot(prev => ({ ...prev, isInstalled: installed }));
    }).catch(() => {
      setSnapshot(prev => ({ ...prev, isInstalled: false }));
    });
  }, []);

  useEffect(() => {
    const unlistens: (() => void)[] = [];

    const setupListeners = async () => {


      const unlistenEvent = await listen<TerracottaStatePayload>('p2p_event', (event) => {
        const payload = event.payload;
        setSnapshot(prev => {
          const next = { ...prev };
          
          if (payload.state === 'ide' || payload.state === 'idle') {
            next.lifecycle = 'idle';
            next.isBusy = false;
            next.busyLabel = null;
          } else if (payload.state === 'scanning') {
            next.lifecycle = 'scanning';
            next.role = 'host';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = false;
            next.busyLabel = null;
          } else if (payload.state === 'guesting') {
            next.lifecycle = 'guesting';
            next.role = 'client';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = true;
            next.busyLabel = '正在连接到房间...';
          } else if (payload.state === 'connected') {
            next.lifecycle = 'connected';
            next.isBusy = false;
            next.busyLabel = null;
            next.roomCode = payload.room || next.roomCode;
          } else if (payload.state === 'exception') {
            next.lifecycle = 'exception';
            next.lastError = payload.type || '未知异常';
            next.isBusy = false;
            next.busyLabel = null;
          }

          // Map Terracotta's host states
          if (payload.state === 'host-starting') {
            next.lifecycle = 'scanning';
            next.role = 'host';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = true;
            next.busyLabel = '正在创建房间...';
          } else if (payload.state === 'host-ok') {
            next.lifecycle = 'connected';
            next.role = 'host';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = false;
            next.busyLabel = null;
          } else if (payload.state === 'guest-connecting') {
            next.lifecycle = 'guesting';
            next.role = 'client';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = true;
            next.busyLabel = '正在连接到房间...';
          } else if (payload.state === 'guest-starting') {
            next.lifecycle = 'guesting';
            next.role = 'client';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = true;
            next.busyLabel = '正在启动隧道...';
          } else if (payload.state === 'guest-ok') {
            next.lifecycle = 'connected';
            next.role = 'client';
            next.roomCode = payload.room || next.roomCode;
            next.isBusy = false;
            next.busyLabel = null;
          }

          return next;
        });
      });
      unlistens.push(unlistenEvent);

      const unlistenLog = await listen<any>('terracotta_log', (event) => {
        setSnapshot(prev => {
          const newLog: TerracottaLogEntry = {
            id: crypto.randomUUID(),
            level: event.payload.level,
            message: event.payload.message,
            timestamp: new Date().toISOString(),
            source: event.payload.source
          };
          return {
            ...prev,
            logs: [...prev.logs, newLog].slice(-500) // keep last 500 lines
          };
        });
      });
      unlistens.push(unlistenLog);
    };

    setupListeners();

    return () => {
      unlistens.forEach(fn => fn());
    };
  }, []);

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    try {
      setSnapshot(prev => ({ ...prev, isBusy: true, busyLabel: '正在启动并创建房间...', roomCode: input.room || null }));
      await invoke('create_p2p_room', { 
        room: input.room || null, 
        player: input.player || null, 
        publicNodes: input.public_nodes || [] 
      });
    } catch (err: any) {
      setSnapshot(prev => ({ 
        ...prev, 
        isBusy: false, 
        busyLabel: null, 
        lastError: err.toString(),
        lifecycle: 'exception' 
      }));
      throw err;
    }
  }, []);

  const joinRoom = useCallback(async (input: JoinRoomInput) => {
    try {
      setSnapshot(prev => ({ ...prev, isBusy: true, busyLabel: '正在启动并加入房间...', roomCode: input.room || null }));
      await invoke('join_p2p_room', { 
        room: input.room, 
        player: input.player || null, 
        publicNodes: input.public_nodes || [] 
      });
    } catch (err: any) {
      setSnapshot(prev => ({ 
        ...prev, 
        isBusy: false, 
        busyLabel: null, 
        lastError: err.toString(),
        lifecycle: 'exception' 
      }));
      throw err;
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await invoke('stop_p2p_session');
      setSnapshot(prev => ({
        ...prev,
        lifecycle: 'idle',
        role: null,
        roomCode: null,
        isBusy: false,
        busyLabel: null
      }));
    } catch (err) {
      console.error("Failed to stop p2p session:", err);
    }
  }, []);

  const setIdle = useCallback(async () => {
    try {
      await invoke('set_p2p_idle');
    } catch (err) {
      console.error("Failed to set p2p idle:", err);
    }
  }, []);



  return {
    ...snapshot,
    createRoom,
    joinRoom,
    stop,
    setIdle
  };
};
