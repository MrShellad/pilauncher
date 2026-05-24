import React from 'react';

import { useRuntimeRepairDialogStore } from '../../../store/useRuntimeRepairDialogStore';
import { RuntimeRepairDialog } from './RuntimeRepairDialog';

const idleProgress = {
  current: 0,
  total: 1,
  message: '',
};

export const RuntimeRepairDialogHost: React.FC = () => {
  const prompt = useRuntimeRepairDialogStore((state) => state.prompt);
  const resolvePrompt = useRuntimeRepairDialogStore((state) => state.resolvePrompt);

  return (
    <RuntimeRepairDialog
      isOpen={!!prompt}
      verifyState="repair"
      verifyProgress={idleProgress}
      verifyIssues={prompt?.issues ?? []}
      verifyError=""
      canClose
      onClose={() => resolvePrompt(false)}
      onConfirm={() => resolvePrompt(true)}
      confirmFocusKey="runtime-repair-confirm"
      cancelFocusKey="runtime-repair-cancel"
    />
  );
};
