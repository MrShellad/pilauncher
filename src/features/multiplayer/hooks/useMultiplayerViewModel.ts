import { useState, useEffect } from 'react';
import { useTerracottaSession } from './useTerracottaSession';
import type { TerracottaRole } from '../types';
import { copyText } from '../utils';

export type SessionFlow = Exclude<TerracottaRole, null>;

const defaultPublicNodes = import.meta.env.VITE_TERRACOTTA_PUBLIC_NODES?.trim() || 'https://terr.s2.mrshell.cn';

export const CUSTOM_NODES_KEY = 'ore:terracotta_public_nodes';
export const getCachedPublicNodes = () => localStorage.getItem(CUSTOM_NODES_KEY) || defaultPublicNodes;
export const setCachedPublicNodes = (nodes: string) => {
  if (!nodes.trim()) localStorage.removeItem(CUSTOM_NODES_KEY);
  else localStorage.setItem(CUSTOM_NODES_KEY, nodes);
};

export function useMultiplayerViewModel() {
  const session = useTerracottaSession();

  const [selectedFlow, setSelectedFlow] = useState<SessionFlow | null>(session.role);
  
  // Host
  const [hostRoom, setHostRoom] = useState('');
  const [hostPlayer, setHostPlayer] = useState('');
  
  // Client
  const [clientRoom, setClientRoom] = useState('');
  const [clientPlayer, setClientPlayer] = useState('');

  // Common
  const [publicNodes, setPublicNodes] = useState(getCachedPublicNodes());
  
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    if (session.role) {
      setSelectedFlow(session.role);
    }
  }, [session.role]);

  useEffect(() => {
    if (!copyState) return undefined;
    const timeoutId = window.setTimeout(() => setCopyState(null), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const canCreateRoom = !session.isBusy && (session.role === null || session.role === 'host') && session.lifecycle === 'idle';
  const canJoinRoom = !session.isBusy && (session.role === null || session.role === 'client') && session.lifecycle === 'idle';
  const canReturnToChooser = selectedFlow !== null && session.role === null;
  const shouldShowIdleLog = session.logs.length > 0 || session.lifecycle !== 'idle';

  const handleCopy = async (key: string, value?: string | null) => {
    try {
      const copied = await copyText(value || '');
      if (copied) setCopyState(key);
    } catch {
      // Ignore clipboard errors
    }
  };

  const getNodesArray = () => publicNodes.split(',').map((s: string) => s.trim()).filter(Boolean);

  const handleCreateRoom = async () => {
    setCachedPublicNodes(publicNodes);
    
    // 如果没有输入自定义口令，前端自动生成一个 6 位的口令，这样可以形成闭环，并且两端都能看见
    let finalRoom = hostRoom.trim();
    if (!finalRoom) {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      finalRoom = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      setHostRoom(finalRoom);
    }
    
    await session.createRoom({
      room: finalRoom,
      player: hostPlayer.trim() || undefined,
      public_nodes: getNodesArray()
    });
  };

  const handleJoinRoom = async () => {
    setCachedPublicNodes(publicNodes);
    await session.joinRoom({
      room: clientRoom.trim(),
      player: clientPlayer.trim() || undefined,
      public_nodes: getNodesArray()
    });
  };

  return {
    session,

    selectedFlow,
    setSelectedFlow,
    canReturnToChooser,
    shouldShowIdleLog,

    hostRoom,
    setHostRoom,
    hostPlayer,
    setHostPlayer,
    canCreateRoom,

    clientRoom,
    setClientRoom,
    clientPlayer,
    setClientPlayer,
    canJoinRoom,

    publicNodes,
    setPublicNodes,

    copyState,
    handleCopy,
    handleCreateRoom,
    handleJoinRoom,
  };
}
