// /src/features/home/components/InstanceSelectModal.tsx
import React from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreInstanceCard } from '../../../ui/primitives/OreInstanceCard';

// 模拟数据：实际项目中可移至专门的 mock 文件，或从 Zustand store 读取
export const MOCK_INSTANCES = [
  { id: '1', name: 'Vanilla 1.20.4', mcVersion: '1.20.4', loaderType: 'Vanilla', lastPlayed: '今天' },
  { id: '2', name: 'Fabric 优化包', mcVersion: '1.19.2', loaderType: 'Fabric 0.15.7', lastPlayed: '昨天' },
  { id: '3', name: 'Forge 整合包', mcVersion: '1.16.5', loaderType: 'Forge 36.2.39', lastPlayed: '2026-02-14' },
  { id: '4', name: 'OptiFine 纯净版', mcVersion: '1.8.9', loaderType: 'OptiFine HD U M5', lastPlayed: '很久以前' },
];

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
  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Instance"
      className="w-full max-w-4xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
        {MOCK_INSTANCES.map((instance) => (
          <OreInstanceCard
            key={instance.id}
            id={instance.id}
            name={instance.name}
            mcVersion={instance.mcVersion}
            loaderType={instance.loaderType}
            lastPlayed={instance.lastPlayed}
            isActive={instance.id === selectedId}
            onClick={onSelect}
            className="w-full h-64"
          />
        ))}
      </div>
    </OreModal>
  );
};