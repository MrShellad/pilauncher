import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, Blocks, Image as ImageIcon, Package } from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { InstanceModDownloadView } from '../features/InstanceDetail/components/tabs/mods/InstanceModDownloadView';
import { useLauncherStore } from '../store/useLauncherStore';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { OreButton } from '../ui/primitives/OreButton';

const InstanceModDownloadPage: React.FC = () => {
  const instanceId = useLauncherStore((state) => state.selectedInstanceId);
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const target = useLauncherStore((state) => state.instanceDownloadTarget);

  const pageMeta = useMemo(() => {
    if (target === 'resourcepack') {
      return { title: '实例资源包下载', icon: Package };
    }
    if (target === 'shader') {
      return { title: '实例光影下载', icon: ImageIcon };
    }
    return { title: '实例模组下载', icon: Blocks };
  }, [target]);

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
      <div className="flex items-center justify-between border-b-2 border-[#2A2A2C] bg-[#18181B] px-5 py-3">
        <OreButton
          focusKey="instance-mod-page-back"
          variant="secondary"
          size="auto"
          onClick={handleBackToInstance}
          onArrowPress={(direction) => {
            if (direction !== 'down') return true;
            const next = ['inst-filter-search', 'inst-filter-source'].find((key) => doesFocusableExist(key));
            if (next) {
              setFocus(next);
              return false;
            }
            return true;
          }}
          className="!h-[40px]"
        >
          <ArrowLeft size={16} className="mr-2" />
          返回实例详情
        </OreButton>

        <div className="pointer-events-none flex items-center gap-2 font-minecraft text-sm uppercase tracking-[0.18em] text-[#E6E8EB]">
          <pageMeta.icon size={16} className="text-ore-green" />
          {pageMeta.title}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <InstanceModDownloadView
          instanceId={instanceId}
          onBack={handleBackToInstance}
          showFilterBackButton={false}
          resourceTab={target}
        />
      </div>
    </FocusBoundary>
  );
};

export default InstanceModDownloadPage;
