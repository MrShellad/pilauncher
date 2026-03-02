// /src/features/home/components/InstanceSelectModal.tsx
import React from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreInstanceCard } from '../../../ui/primitives/OreInstanceCard';

// 引入真实的实例 Hook
import { useInstances } from '../../../hooks/pages/Instances/useInstances';

interface InstanceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  onClose,
  selectedId,
  onSelect,
}) => {
  // 获取真实的实例列表数据
  const { instances } = useInstances();

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="选择启动实例"
      className="w-full max-w-4xl"
    >
      {instances.length === 0 ? (
        // 空状态提示
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50 m-2">
          <span className="text-ore-text-muted font-minecraft mb-2 tracking-wider">
            尚未创建任何实例
          </span>
          <span className="text-[#A0A0A0] font-minecraft text-xs">
            请前往「实例管理」页面创建或导入你的第一个游戏环境
          </span>
        </div>
      ) : (
        // 实例列表：增加最大高度和丝滑滚动
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-6">
          {instances.map((instance) => (
            <OreInstanceCard
              key={instance.id}
              id={instance.id}
              name={instance.name}
              mcVersion={instance.version}   // 映射真实数据的字段名
              loaderType={instance.loader}   // 映射真实数据的字段名
              lastPlayed={instance.lastPlayed}
              coverUrl={instance.coverUrl}   // 传入我们在 Hook 中处理好的封面地址
              isActive={instance.id === selectedId}
              onClick={() => onSelect(instance.id)}
              className="w-full h-64"
            />
          ))}
        </div>
      )}
    </OreModal>
  );
};