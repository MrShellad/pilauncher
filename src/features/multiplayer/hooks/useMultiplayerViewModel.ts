import { useState, useEffect } from 'react';
import { usePiHubSession } from './usePiHubSession';
import { useSignalingServers } from './useSignalingServers';
import type { PiHubRole } from '../types';
import { copyText } from '../utils';

export type SessionFlow = Exclude<PiHubRole, null>;

const defaultSignalingServer = import.meta.env.VITE_PIHUB_SIGNALING_SERVER?.trim() || '';
const defaultHostPort = String(import.meta.env.VITE_PIHUB_TARGET_MC_PORT?.trim() || '25565');
const defaultLocalProxyPort = String(import.meta.env.VITE_PIHUB_LOCAL_PROXY_PORT?.trim() || '50001');

export const CUSTOM_SIGNALING_KEY = 'ore:custom_signaling_url';
export const getCachedCustomSignaling = () => localStorage.getItem(CUSTOM_SIGNALING_KEY) || '';
export const setCachedCustomSignaling = (url: string) => {
  if (!url.trim()) localStorage.removeItem(CUSTOM_SIGNALING_KEY);
  else localStorage.setItem(CUSTOM_SIGNALING_KEY, url);
};

const toSafePort = (value: string, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
};

export function useMultiplayerViewModel() {
  const session = usePiHubSession();
  const { servers, isLoadingServers, fetchServers, resetFetchState } = useSignalingServers();

  const [selectedFlow, setSelectedFlow] = useState<SessionFlow | null>(session.role);
  const [hostPort, setHostPort] = useState(defaultHostPort);
  const [hostSignalingServer, setHostSignalingServer] = useState(defaultSignalingServer);
  
  const [inviteInput, setInviteInput] = useState('');
  const [clientProxyPort, setClientProxyPort] = useState(defaultLocalProxyPort);
  const [clientSignalingServer, setClientSignalingServer] = useState(defaultSignalingServer);
  
  const [hostAnswerInput, setHostAnswerInput] = useState('');
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    if (session.signalingServer) {
      setHostSignalingServer(session.signalingServer);
      setClientSignalingServer(session.signalingServer);
    }
  }, [session.signalingServer]);

  useEffect(() => {
    if (session.lifecycle === 'ready') {
      void fetchServers();
    } else if (session.lifecycle === 'idle' || session.lifecycle === 'stopped') {
      resetFetchState();
    }
  }, [session.lifecycle, fetchServers, resetFetchState]);

  useEffect(() => {
    if (servers.length > 0 && !session.signalingServer) {
      const fastest = servers.reduce((prev, curr) => {
        const prevLat = prev.measuredLatencyMs ?? Infinity;
        const currLat = curr.measuredLatencyMs ?? Infinity;
        return currLat < prevLat ? curr : prev;
      }, servers[0]);

      if (fastest && fastest.url) {
        setHostSignalingServer(fastest.url);
        setClientSignalingServer(fastest.url);
      }
    }
  }, [servers, session.signalingServer]);

  useEffect(() => {
    if (session.localProxyPort) {
      setClientProxyPort(String(session.localProxyPort));
    }
  }, [session.localProxyPort]);

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

  const canCreateRoom = !session.isBusy && (session.role === null || session.role === 'host') && !session.inviteCode;
  const canJoinRoom = !session.isBusy && (session.role === null || session.role === 'client') && !session.answerCode;
  const canAcceptAnswer = !session.isBusy && session.role === 'host' && Boolean(session.inviteCode);
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

  const handleCreateRoom = async () => {
    await session.createRoom({
      targetMcPort: toSafePort(hostPort, 25565),
      signalingServer: hostSignalingServer
    });
  };

  const handleJoinRoom = async () => {
    await session.joinRoom({
      inviteCode: inviteInput,
      localProxyPort: toSafePort(clientProxyPort, 50001),
      signalingServer: clientSignalingServer
    });
  };

  const handleAcceptAnswer = async () => {
    await session.acceptAnswer(hostAnswerInput);
  };

  return {
    // Domain Session
    session,

    // Signaling Servers
    servers,
    isLoadingServers,

    // UI Flow State
    selectedFlow,
    setSelectedFlow,
    canReturnToChooser,
    shouldShowIdleLog,

    // Host Flow Inputs
    hostPort,
    setHostPort,
    hostSignalingServer,
    setHostSignalingServer,
    hostAnswerInput,
    setHostAnswerInput,
    canCreateRoom,
    canAcceptAnswer,

    // Client Flow Inputs
    inviteInput,
    setInviteInput,
    clientProxyPort,
    setClientProxyPort,
    clientSignalingServer,
    setClientSignalingServer,
    canJoinRoom,

    // Copy State
    copyState,

    // Actions
    handleCopy,
    handleCreateRoom,
    handleJoinRoom,
    handleAcceptAnswer
  };
}
