import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';

import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import { OreProgressBar } from '../../../ui/primitives/OreProgressBar';
import type { VerifyDialogState, VerifyProgress } from '../../InstanceDetail/components/tabs/BasicPanel/schemas/basicPanelSchemas';
import {
  getVerifyConfirmLabel,
  getVerifyDialogDescription,
  getVerifyDialogHeadline,
  getVerifyDialogTitle,
  getVerifyDialogTone,
  shouldUseSingleVerifyClose,
} from '../../InstanceDetail/components/tabs/BasicPanel/utils/maintenanceSectionUtils';
import { getVerifyPercent } from '../../InstanceDetail/components/tabs/BasicPanel/utils/verifyInstanceUtils';

interface RuntimeRepairDialogProps {
  isOpen: boolean;
  verifyState: VerifyDialogState;
  verifyProgress: VerifyProgress;
  verifyIssues: string[];
  verifyError: string;
  canClose: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmFocusKey: string;
  cancelFocusKey: string;
}

const formatIssue = (issue: string) =>
  issue
    .replace('Missing file: ', '缺失文件: ')
    .replace('SHA1 mismatch: ', '文件校验失败: ');

export const RuntimeRepairDialog: React.FC<RuntimeRepairDialogProps> = ({
  isOpen,
  verifyState,
  verifyProgress,
  verifyIssues,
  verifyError,
  canClose,
  onClose,
  onConfirm,
  confirmFocusKey,
  cancelFocusKey,
}) => {
  const verifyDialogTone = getVerifyDialogTone(verifyState);
  const verifyDialogTitle = getVerifyDialogTitle(verifyState);
  const verifyDialogHeadline = getVerifyDialogHeadline(verifyState);
  const verifyDialogDescription = getVerifyDialogDescription(
    verifyState,
    verifyError,
    verifyProgress.message,
  );
  const verifyConfirmLabel = getVerifyConfirmLabel(verifyState);
  const verifySingleClose = shouldUseSingleVerifyClose(verifyState);
  const verifyPercent = getVerifyPercent(verifyProgress);

  return (
    <OreConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={verifyDialogTitle}
      headline={<span className="block min-h-[1.75rem] leading-6">{verifyDialogHeadline}</span>}
      description={
        <span className="block min-h-[2.5rem] leading-5 text-ore-text-muted">
          {verifyDialogDescription}
        </span>
      }
      confirmLabel={verifyConfirmLabel}
      hideCancelButton={verifySingleClose}
      cancelLabel={verifyState === 'repair' ? '暂不补全' : '关闭'}
      confirmVariant={verifyState === 'repair' ? 'primary' : 'secondary'}
      tone={verifyDialogTone}
      confirmFocusKey={confirmFocusKey}
      cancelFocusKey={cancelFocusKey}
      bodyClassName="flex h-full flex-col items-center justify-start text-center"
      modalContentClassName="!p-5 overflow-hidden"
      confirmIcon={
        verifyState === 'repair' ? (
          <Wrench size="1rem" className="mr-2" />
        ) : (
          <ShieldCheck size="1rem" className="mr-2" />
        )
      }
      dialogIcon={
        verifyState === 'clean' || verifyState === 'queued' ? (
          <CheckCircle2 size="2rem" className="text-ore-green" />
        ) : verifyState === 'error' ? (
          <AlertTriangle size="2rem" className="text-red-500" />
        ) : (
          <ShieldCheck
            size="2rem"
            className={verifyState === 'verifying' ? 'text-sky-400 animate-pulse' : 'text-sky-400'}
          />
        )
      }
      isConfirming={verifyState === 'verifying' || verifyState === 'repairing'}
      closeOnOutsideClick={canClose}
      className="w-[35rem] h-[27.5rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]"
    >
      {(verifyState === 'verifying' || verifyState === 'repairing') && (
        <OreProgressBar
          className="mt-4"
          percent={verifyPercent}
          label={verifyState === 'verifying' ? '正在进行整体校验...' : '正在进行运行时补全...'}
        />
      )}

      {verifyState === 'repair' && verifyIssues.length > 0 && (
        <div className="mt-4 w-full border-2 border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-0.25rem_#333334,inset_0.1875rem_0.1875rem_rgba(255,255,255,0.1)] px-4 py-3 text-left text-sm text-white font-bold drop-shadow-[0_0.125rem_0_rgba(0,0,0,0.5)]">
          <div className="truncate">{formatIssue(verifyIssues[0])}</div>
          {verifyIssues.length > 1 && (
            <div className="mt-2 text-[#FFE866] flex items-center">
              <AlertTriangle size="0.875rem" className="mr-1.5" />
              ... 及其他 {verifyIssues.length - 1} 处异常被检测到
            </div>
          )}
        </div>
      )}
    </OreConfirmDialog>
  );
};
