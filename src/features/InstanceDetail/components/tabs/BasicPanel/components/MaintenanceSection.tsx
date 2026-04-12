import React from 'react';
import { ShieldCheck, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { OreConfirmDialog } from '../../../../../../ui/primitives/OreConfirmDialog';

import { useVerifyInstance } from '../hooks/useVerifyInstance';
import type {
  MissingRuntime,
  VerifyInstanceRuntimeResult,
} from '../../../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface MaintenanceSectionProps {
  instanceId: string;
  isInitializing: boolean;
  isGlobalSaving: boolean;
  onVerifyFiles: () => Promise<VerifyInstanceRuntimeResult>;
  onRepairFiles: (repair: MissingRuntime) => Promise<void>;
}

export const MaintenanceSection: React.FC<MaintenanceSectionProps> = ({
  instanceId,
  isInitializing,
  isGlobalSaving,
  onVerifyFiles,
  onRepairFiles,
}) => {
  const {
    isVerifyDialogOpen,
    verifyState,
    verifyProgress,
    canCloseVerifyDialog,
    verifyBusy,
    verifyPercent,
    verifyIssues,
    handleStartVerify,
    handleCloseVerifyDialog,
    handleConfirmVerifyDialog,
    verifyError,
  } = useVerifyInstance(instanceId, onVerifyFiles, onRepairFiles);

  const verifyDialogTone =
    verifyState === 'repair' || verifyState === 'repairing'
      ? 'warning'
      : verifyState === 'error'
        ? 'danger'
        : 'info';

  const verifyDialogTitle =
    verifyState === 'repair'
      ? '校验发现异常'
      : verifyState === 'repairing'
        ? '正在补全文件'
        : verifyState === 'clean'
          ? '校验完成'
          : verifyState === 'queued'
            ? '已加入下载队列'
            : verifyState === 'error'
              ? '校验失败'
              : '正在校验文件';

  const verifyDialogHeadline =
    verifyState === 'repair'
      ? '检测到文件缺失或哈希不一致。'
      : verifyState === 'repairing'
        ? '正在调用下载管理补全运行时文件。'
        : verifyState === 'clean'
          ? '当前实例运行时文件完整。'
          : verifyState === 'queued'
            ? '补全任务已加入下载管理。'
            : verifyState === 'error'
              ? '校验过程出现错误。'
              : '请稍候，正在逐项校验。';

  const verifyDialogDescription =
    verifyState === 'repair'
      ? '确认后将自动打开下载管理并开始补全。'
      : verifyState === 'queued'
        ? '你可以在下载管理中查看实时进度。'
        : verifyState === 'error'
          ? verifyError || '未知错误'
          : verifyState === 'clean'
            ? '未发现需要补全的运行时文件。'
            : verifyProgress.message || '正在校验运行时...';

  const verifyConfirmLabel =
    verifyState === 'repair'
      ? '开始补全'
      : verifyState === 'repairing'
        ? '补全中'
        : verifyState === 'verifying'
          ? '校验中'
          : '关闭';

  const verifySingleClose = verifyState === 'clean';

  const verifyHeadlineNode = (
    <span className="block min-h-[1.75rem] leading-6">
      {verifyDialogHeadline}
    </span>
  );
  const verifyDescriptionNode = (
    <span className="block min-h-[2.5rem] leading-5 text-ore-text-muted">
      {verifyDialogDescription}
    </span>
  );

  return (
    <>
      <SettingsSection title="实例维护" icon={<Wrench size={18} />}>
        <FormRow
          label="补全缺失文件"
          description="自动检查并重新下载缺失的核心文件、运行库或依赖资源。"
          control={
            <OreButton
              focusKey="basic-btn-verify-files"
              variant="secondary"
              onClick={handleStartVerify}
              disabled={isGlobalSaving || isInitializing || verifyBusy}
              className="w-40"
            >
              <ShieldCheck size={16} className="mr-2" /> 校验补全
            </OreButton>
          }
        />
      </SettingsSection>

      <OreConfirmDialog
        isOpen={isVerifyDialogOpen}
        onClose={handleCloseVerifyDialog}
        onConfirm={() => {
          void handleConfirmVerifyDialog();
        }}
        title={verifyDialogTitle}
        headline={verifyHeadlineNode}
        description={verifyDescriptionNode}
        confirmLabel={verifyConfirmLabel}
        hideCancelButton={verifySingleClose}
        cancelLabel={verifyState === 'repair' ? '暂不补全' : '关闭'}
        confirmVariant={verifyState === 'repair' ? 'primary' : 'secondary'}
        tone={verifyDialogTone}
        confirmFocusKey="basic-verify-confirm"
        cancelFocusKey="basic-verify-cancel"
        bodyClassName="flex h-full flex-col items-center justify-start text-center"
        modalContentClassName="!p-5 overflow-hidden"
        confirmIcon={
          verifyState === 'repair' ? (
            <Wrench size={16} className="mr-2" />
          ) : (
            <ShieldCheck size={16} className="mr-2" />
          )
        }
        dialogIcon={
          verifyState === 'clean' || verifyState === 'queued' ? (
            <CheckCircle2 size={32} className="text-ore-green" />
          ) : verifyState === 'error' ? (
            <AlertTriangle size={32} className="text-red-500" />
          ) : (
            <ShieldCheck
              size={32}
              className={verifyState === 'verifying' ? 'text-sky-400 animate-pulse' : 'text-sky-400'}
            />
          )
        }
        isConfirming={verifyState === 'verifying' || verifyState === 'repairing'}
        closeOnOutsideClick={canCloseVerifyDialog}
        className="w-[560px] h-[440px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]"
      >
        {(verifyState === 'verifying' || verifyState === 'repairing') && (
          <div className="mt-4 w-full max-h-[172px] space-y-3 overflow-y-auto px-2 custom-scrollbar">
            <div className="overflow-hidden rounded-full border-2 border-[#2A2A2C] bg-[#141415] shadow-inner">
              <div
                className="h-3 bg-[#3C8527] transition-[width] duration-200"
                style={{ width: `${verifyPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#A1A3A5]">
              <span>{verifyProgress.message || '正在校验文件...'}</span>
              <span className="text-ore-green">{verifyPercent}%</span>
            </div>
          </div>
        )}

        {verifyState === 'repair' && verifyIssues.length > 0 && (
          <div className="mt-4 w-full max-h-[172px] overflow-y-auto rounded-sm border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-left text-sm text-yellow-100 custom-scrollbar">
            {verifyIssues.map((issue, index) => (
              <div key={`${issue}-${index}`} className={index > 0 ? 'mt-2' : ''}>
                {issue}
              </div>
            ))}
          </div>
        )}
      </OreConfirmDialog>
    </>
  );
};
