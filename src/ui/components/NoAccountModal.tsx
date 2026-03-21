import React from 'react';
import { AlertTriangle, UserPlus } from 'lucide-react';
import { OreModal } from '../primitives/OreModal';
import { OreButton } from '../primitives/OreButton';
import { useLauncherStore } from '../../store/useLauncherStore';

interface NoAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoAccountModal: React.FC<NoAccountModalProps> = ({ isOpen, onClose }) => {
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const handleGoToSettings = () => {
    onClose();
    setActiveTab('settings');
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="无法启动实例"
      className="w-[420px]"
    >
      <div className="flex flex-col items-center justify-center pt-2 pb-4 px-4 text-center">

        {/* 红色发光的警告图标 */}
        <div className="w-16 h-16 rounded-full bg-[#E52E3D]/10 border-2 border-[#E52E3D]/20 flex items-center justify-center mb-4 shadow-[inset_0_0_15px_rgba(229,46,61,0.2)]">
          <AlertTriangle size={32} className="text-[#E52E3D] drop-shadow-[0_0_8px_rgba(229,46,61,0.8)]" />
        </div>

        <h3 className="text-white font-minecraft font-bold text-xl mb-2 ore-text-shadow">未检测到游戏账号</h3>

        <p className="text-[#A0A0A0] font-minecraft text-sm mb-6 leading-relaxed px-2">
          启动 Minecraft 需要至少一个有效的游戏账号。<br />请前往设置页面添加微软账号。
        </p>

        {/* 底部操作按钮：内置在 Modal 内容区，完美继承空间导航功能 */}
        <div className="flex space-x-4 w-full px-2">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
          >
            取消
          </OreButton>

          <OreButton
            variant="primary"
            size="full"
            onClick={handleGoToSettings}
          >
            <div className="flex items-center justify-center">
              <UserPlus size={18} className="mr-2" />
              <span>添加</span>
            </div>
          </OreButton>
        </div>

      </div>
    </OreModal>
  );
};
