import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';


import { InstanceModDownloadView } from '@/features/instances';
import { useLauncherStore } from '@/app/stores/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { OreButton } from '../ui/primitives/OreButton';

const InstanceModDownloadPage: React.FC = () => {
  const { t } = useTranslation();
  const instanceId = useLauncherStore((state) => state.selectedInstanceId);
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const target = useLauncherStore((state) => state.instanceDownloadTarget);



  const handleBackToInstance = () => {
    setActiveTab('instance-detail');
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      handleBackToInstance();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  if (!instanceId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#141415]">
        <div className="font-minecraft text-lg text-white">未选择实例</div>
        <OreButton
          focusKey="instance-mod-page-back"
          variant="primary"
          onClick={() => setActiveTab('instances')}
        >
          <ArrowLeft size={16} className="mr-2" />
          返回实例列表
        </OreButton>
      </div>
    );
  }

  return (
    <FocusBoundary id="instance-mod-download-page" className="flex h-full w-full flex-col overflow-hidden">
      <h1 className="sr-only">{t('instanceModDownload.title', '模组与资源下载')}</h1>
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <InstanceModDownloadView
          instanceId={instanceId}
          onBack={handleBackToInstance}
          showFilterBackButton={true}
          resourceTab={target}
        />
      </div>
    </FocusBoundary>
  );
};

export default InstanceModDownloadPage;
