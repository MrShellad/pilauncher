// /src/features/Instances/components/InstanceListView.tsx
import React from 'react';
import { OreList } from '../../../ui/primitives/OreList';
import { Pencil } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';

interface InstanceListViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceListView: React.FC<InstanceListViewProps> = ({ instance, onClick, onEdit }) => {
  return (
    <OreList
      title={instance.name}
      subtitle={instance.type}
      onClick={onClick}
      icon={
        <div className="w-24 h-14 bg-[#1E1E1F] border border-black/40 overflow-hidden flex-shrink-0">
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
        <div className="flex items-center h-full pl-4">
          <div className="flex flex-col items-end text-right mr-4 font-minecraft tracking-wider text-ore-text-muted">
            <span className="text-xs">{instance.size}</span>
            <span className="text-[10px] opacity-70 mt-0.5">{instance.date}</span>
          </div>
          <div className="w-px h-12 bg-ore-gray-border/50 mx-2"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex flex-col items-center justify-center w-14 h-full text-white hover:bg-white/10 transition-colors focus:outline-none"
          >
            <Pencil size={18} className="mb-1 text-ore-text-muted" />
            <span className="text-[10px] font-minecraft text-ore-text-muted">编辑</span>
          </button>
        </div>
      }
    />
  );
};