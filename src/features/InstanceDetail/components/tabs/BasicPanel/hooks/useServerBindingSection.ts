import { useCallback, useState } from 'react';

import {
  canSaveServerBinding,
  createEmptyServerBindingEditState,
  createServerBindingEditState,
  createServerBindingUpdate,
  sanitizeServerPortInput,
} from '../utils/serverBindingSectionUtils';
import type { ServerBindingInfo } from '../schemas/basicPanelSchemas';

interface UseServerBindingSectionOptions {
  serverBinding?: ServerBindingInfo | null;
  onUpdateServerBinding: (binding: ServerBindingInfo | null) => Promise<void>;
  onUpdateAutoJoinServer: (autoJoin: boolean) => Promise<void>;
  onSuccess: (msg: string) => void;
  setIsGlobalSaving: (val: boolean) => void;
}

export const useServerBindingSection = ({
  serverBinding,
  onUpdateServerBinding,
  onUpdateAutoJoinServer,
  onSuccess,
  setIsGlobalSaving,
}: UseServerBindingSectionOptions) => {
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [editServer, setEditServer] = useState(createEmptyServerBindingEditState());

  const startAddServer = useCallback(() => {
    setEditServer(createEmptyServerBindingEditState());
    setIsEditingServer(true);
  }, []);

  const startEditServer = useCallback(() => {
    setEditServer(createServerBindingEditState(serverBinding));
    setIsEditingServer(true);
  }, [serverBinding]);

  const cancelEditServer = useCallback(() => {
    setIsEditingServer(false);
  }, []);

  const setEditServerName = useCallback((name: string) => {
    setEditServer((server) => ({ ...server, name }));
  }, []);

  const setEditServerIp = useCallback((ip: string) => {
    setEditServer((server) => ({ ...server, ip }));
  }, []);

  const setEditServerPort = useCallback((port: string) => {
    setEditServer((server) => ({ ...server, port: sanitizeServerPortInput(port) }));
  }, []);

  const handleSaveServer = useCallback(async () => {
    if (!canSaveServerBinding(editServer)) return;

    setIsGlobalSaving(true);
    await onUpdateServerBinding(createServerBindingUpdate(editServer, serverBinding));
    setIsGlobalSaving(false);
    setIsEditingServer(false);
    onSuccess('serverInfoSaved');
  }, [editServer, onSuccess, onUpdateServerBinding, serverBinding, setIsGlobalSaving]);

  const handleUnbindServer = useCallback(async () => {
    setIsGlobalSaving(true);
    await onUpdateServerBinding(null);
    setIsGlobalSaving(false);
    onSuccess('serverUnbound');
  }, [onSuccess, onUpdateServerBinding, setIsGlobalSaving]);

  const handleAutoJoinChange = useCallback(async (checked: boolean) => {
    setIsGlobalSaving(true);
    await onUpdateAutoJoinServer(checked);
    setIsGlobalSaving(false);
    onSuccess(checked ? 'autoJoinEnabled' : 'autoJoinDisabled');
  }, [onSuccess, onUpdateAutoJoinServer, setIsGlobalSaving]);

  return {
    isEditingServer,
    editServer,
    canSaveServer: canSaveServerBinding(editServer),
    startAddServer,
    startEditServer,
    cancelEditServer,
    setEditServerName,
    setEditServerIp,
    setEditServerPort,
    handleSaveServer,
    handleUnbindServer,
    handleAutoJoinChange,
  };
};
