import { useSyncExternalStore } from 'react';
import { pihubClient } from '../pihubClient';
import type { CreateRoomInput, JoinRoomInput } from '../types';

export const usePiHubSession = () => {
  const snapshot = useSyncExternalStore(
    pihubClient.subscribe,
    pihubClient.getSnapshot,
    pihubClient.getSnapshot
  );

  return {
    ...snapshot,
    start: () => pihubClient.start(),
    stop: () => pihubClient.stop(),
    restart: () => pihubClient.restart(),
    createRoom: (input: CreateRoomInput) => pihubClient.createRoom(input),
    joinRoom: (input: JoinRoomInput) => pihubClient.joinRoom(input),
    acceptAnswer: (answerCode: string) => pihubClient.acceptAnswer(answerCode),
    getSignalingServers: () => pihubClient.getSignalingServers()
  };
};
