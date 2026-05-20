import { useCallback, useEffect, useState } from 'react';

import {
  canSaveInstanceName,
  getEditableInstanceName,
} from '../utils/basicInfoSectionUtils';

interface UseBasicInfoSectionOptions {
  initialName: string;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onSuccess: (msg: string) => void;
  setIsGlobalSaving: (val: boolean) => void;
}

export const useBasicInfoSection = ({
  initialName,
  onUpdateName,
  onUpdateCover,
  onSuccess,
  setIsGlobalSaving,
}: UseBasicInfoSectionOptions) => {
  const [editName, setEditName] = useState(getEditableInstanceName(initialName));

  useEffect(() => {
    setEditName(getEditableInstanceName(initialName));
  }, [initialName]);

  const isNameChanged = canSaveInstanceName(editName, initialName);

  const handleSaveName = useCallback(async () => {
    if (!canSaveInstanceName(editName, initialName)) {
      setEditName(getEditableInstanceName(initialName));
      return;
    }

    try {
      setIsGlobalSaving(true);
      await onUpdateName(editName);
      onSuccess('名称已保存');
    } finally {
      setIsGlobalSaving(false);
    }
  }, [editName, initialName, onSuccess, onUpdateName, setIsGlobalSaving]);

  const handleChangeCover = useCallback(async () => {
    try {
      setIsGlobalSaving(true);
      await onUpdateCover();
    } catch (error) {
      console.error('Failed to update instance cover:', error);
    } finally {
      setIsGlobalSaving(false);
    }
  }, [onUpdateCover, setIsGlobalSaving]);

  return {
    editName,
    setEditName,
    isNameChanged,
    handleSaveName,
    handleChangeCover,
  };
};
