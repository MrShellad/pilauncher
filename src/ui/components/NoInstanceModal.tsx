// /src/ui/components/NoInstanceModal.tsx
import React from 'react';
import { PackageOpen, Download, FolderInput } from 'lucide-react';
import { OreModal } from '../primitives/OreModal';
import { OreButton } from '../primitives/OreButton';
import { useLauncherStore } from '../../store/useLauncherStore';

interface NoInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoInstanceModal: React.FC<NoInstanceModalProps> = ({ isOpen, onClose }) => {
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const handleGoToDownload = () => {
    onClose();
    setActiveTab('downloads');
  };

  const handleGoToImport = () => {
    onClose();
    setActiveTab('instances');
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="无法启动游戏"
      className="w-[480px]"
    >
      <div className="flex flex-col items-center justify-center pt-2 pb-4 px-4 text-center">

        {/* 图标 */}
        <div className="w-16 h-16 rounded-full bg-[#E5A02E]/10 border-2 border-[#E5A02E]/20 flex items-center justify-center mb-4 shadow-[inset_0_0_15px_rgba(229,160,46,0.2)]">
          <PackageOpen size={32} className="text-[#E5A02E] drop-shadow-[0_0_8px_rgba(229,160,46,0.8)]" />
        </div>

        <h3 className="text-white font-minecraft font-bold text-xl mb-2 ore-text-shadow">
          尚未创建任何实例
        </h3>

        <p className="text-[#A0A0A0] font-minecraft text-sm mb-6 leading-relaxed px-2">
          启动游戏需要先创建或导入一个游戏实例。<br />
          你可以前往「资源下载」寻找整合包，或从本地导入已有整合包。
        </p>

        <div className="flex space-x-4 w-full px-2">
          <OreButton
            variant="secondary"
            size="full"
            onClick={handleGoToImport}
          >
            <div className="flex items-center justify-center">
              <FolderInput size={18} className="mr-2 flex-shrink-0" />
              <span>导入整合包</span>
            </div>
          </OreButton>

          <OreButton
            variant="primary"
            size="full"
            onClick={handleGoToDownload}
          >
            <div className="flex items-center justify-center">
              <Download size={18} className="mr-2 flex-shrink-0" />
              <span>资源下载</span>
            </div>
          </OreButton>
        </div>

      </div>
    </OreModal>
  );
};
