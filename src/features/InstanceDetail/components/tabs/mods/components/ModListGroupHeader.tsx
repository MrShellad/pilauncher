import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { type ModGroupId, type ModListGroup } from '../modListShared';

interface ModListGroupHeaderProps {
  group: ModListGroup;
  collapsed: boolean;
  focused?: boolean;
  onToggle: (groupId: ModGroupId) => void;
}

export const ModListGroupHeader: React.FC<ModListGroupHeaderProps> = ({ group, collapsed, focused = false, onToggle }) => {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onToggle(group.id)}
      className={`group/header flex min-h-[2.625rem] w-full items-center gap-2 border-y border-white/[0.16] bg-[#3A3A3E] px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline outline-2 outline-offset-[-2px] transition-colors hover:bg-[#444449] ${
        focused ? 'outline-white bg-[#48484D]' : 'outline-black'
      }`}
    >
      <span className="text-[#F1F3F7]">
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      </span>
      <span className="font-minecraft text-[0.8125rem] text-white">{group.label}</span>
      <span className="border border-white/20 bg-[#2E2E32] px-1.5 py-0.5 font-mono text-[0.625rem] text-[#EEF1F6]">
        {group.mods.length}
      </span>
      <span className="min-w-0 truncate text-[0.6875rem] text-[#D8DBE2]">{group.description}</span>
    </button>
  );
};
