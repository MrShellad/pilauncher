import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';


import { InstanceModDownloadView } from '../features/InstanceDetail/components/tabs/mods/InstanceModDownloadView';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { OreButton } from '../ui/primitives/OreButton';

const InstanceModDownloadPage: React.FC = () => {
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
