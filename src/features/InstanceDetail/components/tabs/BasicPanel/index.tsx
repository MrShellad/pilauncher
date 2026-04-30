import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { SettingsPageLayout } from '../../../../../ui/layout/SettingsPageLayout';
import { FocusItem } from '../../../../../ui/focus/FocusItem';

import { BasicInfoSection } from './components/BasicInfoSection';
import { EnvironmentSection } from './components/EnvironmentSection';
import { CustomLinksSection } from './components/CustomLinksSection';
import { ServerBindingSection } from './components/ServerBindingSection';
import { MaintenanceSection } from './components/MaintenanceSection';
import { DangerZoneSection } from './components/DangerZoneSection';
import { useBasicPanelStatus } from './hooks/useBasicPanelStatus';
import type { BasicPanelProps } from './schemas/basicPanelSchemas';

export const BasicPanel: React.FC<BasicPanelProps> = ({
  data,
  isInitializing,
  onUpdateName,
  onUpdateCover,
  onUpdateEnvironment,
  onUpdateCustomButtons,
  onUpdateServerBinding,
  onUpdateAutoJoinServer,
  onVerifyFiles,
  onRepairFiles,
  onDelete,
}) => {
  const { isSaving, setIsSaving, successMsg, triggerSuccess } = useBasicPanelStatus();

  return (
    <SettingsPageLayout>
      <div className="relative flex flex-col w-full h-full gap-[clamp(1.5rem,2vw,2rem)]">

        <FocusItem focusKey="basic-guard-top" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 left-0 w-full h-[0.0625rem] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-left" onFocus={() => setFocus('basic-input-name')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 left-0 w-[0.0625rem] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-right" onFocus={() => setFocus('basic-btn-change-cover')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 right-0 w-[0.0625rem] h-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="basic-guard-bottom" onFocus={() => setFocus('basic-btn-delete-instance')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute bottom-0 left-0 w-full h-[0.0625rem] opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        <div className="flex justify-end h-6 mb-2 pr-6 font-minecraft transition-opacity duration-300">
          {isSaving && (
            <span className="text-ore-text-muted text-sm flex items-center">
              <Loader2 size="0.875rem" className="animate-spin mr-1.5" /> 正在保存...
            </span>
          )}
          {successMsg && !isSaving && (
            <span className="text-ore-green text-sm flex items-center drop-shadow-[0_0_0.3125rem_rgba(56,133,39,0.5)]">
              <CheckCircle2 size="0.875rem" className="mr-1.5" /> {successMsg}
            </span>
          )}
        </div>

        <BasicInfoSection
          initialName={data.name}
          coverUrl={data.coverUrl}
          isInitializing={isInitializing}
          onUpdateName={onUpdateName}
          onUpdateCover={onUpdateCover}
          onSuccess={triggerSuccess}
          isGlobalSaving={isSaving}
          setIsGlobalSaving={setIsSaving}
        />

        <EnvironmentSection
          currentGameVersion={data.version}
          currentLoaderType={data.loader}
          currentLoaderVersion={data.loaderVersion}
          isInitializing={isInitializing}
          onUpdateEnvironment={onUpdateEnvironment}
          onSuccess={triggerSuccess}
          isGlobalSaving={isSaving}
          setIsGlobalSaving={setIsSaving}
        />

        <CustomLinksSection
          initialButtons={data.customButtons}
          isInitializing={isInitializing}
          onUpdateCustomButtons={onUpdateCustomButtons}
          onSuccess={triggerSuccess}
          isGlobalSaving={isSaving}
          setIsGlobalSaving={setIsSaving}
        />

        <ServerBindingSection
          serverBinding={data.serverBinding}
          autoJoinServer={data.autoJoinServer}
          isInitializing={isInitializing}
          onUpdateServerBinding={onUpdateServerBinding}
          onUpdateAutoJoinServer={onUpdateAutoJoinServer}
          onSuccess={triggerSuccess}
          isGlobalSaving={isSaving}
          setIsGlobalSaving={setIsSaving}
        />

        <MaintenanceSection
          instanceId={data.id}
          isInitializing={isInitializing}
          isGlobalSaving={isSaving}
          onVerifyFiles={onVerifyFiles}
          onRepairFiles={onRepairFiles}
        />

        <DangerZoneSection
          instanceName={data.name}
          isInitializing={isInitializing}
          onDelete={onDelete}
          isGlobalSaving={isSaving}
          setIsGlobalSaving={setIsSaving}
        />

      </div>
    </SettingsPageLayout>
  );
};
