// /src/features/Instances/components/InstanceCardView.tsx
import React from 'react';
import { OreCard } from '../../../ui/primitives/OreCard';
import { Pencil } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit }) => {
  return (
    <OreCard
      title={instance.name}
      subtitle={instance.type}
      description={`${instance.size} • ${instance.date}`}
      onClick={onClick}
      icon={
        <div className="w-full h-32 bg-[#1E1E1F] border-b border-black/40 overflow-hidden">
          {instance.coverUrl ? (
            <img 
              src={instance.coverUrl} 
              alt={instance.name} 
              className="w-full h-full object-cover opacity-90"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-ore-text-muted">
              No Image
            </div>
          )}
        </div>
      }
      actions={
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex items-center justify-center w-full py-2 text-white hover:bg-white/10 transition-colors focus:outline-none"
        >
          <Pencil size={16} className="mr-2 text-ore-text-muted" />
          <span className="text-xs font-minecraft text-ore-text-muted tracking-wider">编辑实例</span>
        </button>
      }
    />
  );
};