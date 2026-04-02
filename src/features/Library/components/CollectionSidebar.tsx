import React from 'react';
import type { Collection } from '../../../types/library';

interface CollectionSidebarProps {
  collections: Collection[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}

export const CollectionSidebar: React.FC<CollectionSidebarProps> = ({
  collections,
  selectedGroupId,
  onSelectGroup
}) => {
  return (
    <div className="flex w-full flex-col p-4 text-ore-text space-y-4">
      {/* System Default Groups */}
      <div className="flex flex-col space-y-1">
        <div className="mb-2 px-3 text-xs font-bold text-white/40 uppercase tracking-wider">库分类 Library</div>
        <button
          onClick={() => onSelectGroup('all')}
          className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            selectedGroupId === 'all'
              ? 'bg-ore-primary/20 text-ore-primary shadow-[inset_2px_0_0_0_currentColor]'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="mr-3 text-lg">📚</span>
          全部资源
        </button>
      </div>

      <div className="h-px w-full bg-white/5" />

      {/* User Built Collections */}
      <div className="flex flex-col space-y-1">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider">整合包 Modpacks</span>
          <button className="text-white/40 hover:text-white focus:outline-none transition-colors">
            ➕
          </button>
        </div>
        {collections.filter(c => c.type === 'modpack').length === 0 ? (
          <div className="px-3 py-2 text-sm text-white/30 italic">暂无整合包</div>
        ) : (
          collections.filter(c => c.type === 'modpack').map(c => (
            <button
              key={c.id}
              onClick={() => onSelectGroup(c.id)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                selectedGroupId === c.id
                  ? 'bg-ore-secondary/20 text-ore-secondary shadow-[inset_2px_0_0_0_currentColor]'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">📦</span>
              {c.name}
            </button>
          ))
        )}
      </div>

      <div className="h-px w-full bg-white/5" />

      <div className="flex flex-col space-y-1">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider">分组 Groups</span>
          <button className="text-white/40 hover:text-white focus:outline-none transition-colors">
            ➕
          </button>
        </div>
        {collections.filter(c => c.type === 'group').length === 0 ? (
          <div className="px-3 py-2 text-sm text-white/30 italic">暂无自定义分组</div>
        ) : (
          collections.filter(c => c.type === 'group').map(c => (
            <button
              key={c.id}
              onClick={() => onSelectGroup(c.id)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                selectedGroupId === c.id
                  ? 'bg-white/10 text-white shadow-[inset_2px_0_0_0_currentColor]'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">📁</span>
              {c.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
