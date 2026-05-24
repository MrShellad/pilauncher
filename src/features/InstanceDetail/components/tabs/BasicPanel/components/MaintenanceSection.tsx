import React from 'react';
import { ShieldCheck, Wrench } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { RuntimeRepairDialog } from '../../../../../runtime/components/RuntimeRepairDialog';

import { useVerifyInstance } from '../hooks/useVerifyInstance';
import type { MaintenanceSectionProps } from '../schemas/basicPanelSchemas';

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
    verifyIssues,
    handleStartVerify,
    handleCloseVerifyDialog,
    handleConfirmVerifyDialog,
    verifyError,
  } = useVerifyInstance(instanceId, onVerifyFiles, onRepairFiles);

  return (
    <>
      <SettingsSection title="实例维护" icon={<Wrench size="1.125rem" />}>
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
              <ShieldCheck size="1rem" className="mr-2" /> 校验补全
            </OreButton>
          }
        />
      </SettingsSection>

      <RuntimeRepairDialog
        isOpen={isVerifyDialogOpen}
        verifyState={verifyState}
        verifyProgress={verifyProgress}
        verifyIssues={verifyIssues}
        verifyError={verifyError}
        canClose={canCloseVerifyDialog}
        onClose={handleCloseVerifyDialog}
        onConfirm={() => {
          void handleConfirmVerifyDialog();
        }}
        confirmFocusKey="basic-verify-confirm"
        cancelFocusKey="basic-verify-cancel"
      />
    </>
  );
};
