import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { type ModGroupId, type ModListGroup } from '../modListShared';

interface ModListGroupHeaderProps {
  group: ModListGroup;
  collapsed: boolean;
  focused?: boolean;
  onToggle: (groupId: ModGroupId) => void;
}

const GROUP_ACCENT_COLORS: Record<ModGroupId, string> = {
  libraries: '#5B8CFF',
  performance: '#57D38C',
  content: '#F5A524',
  manual: '#B07CFF',
  uncategorized: '#8B93A7'
};

export const ModListGroupHeader: React.FC<ModListGroupHeaderProps> = ({ group, collapsed, focused = false, onToggle }) => {
  const accentColor = GROUP_ACCENT_COLORS[group.id];

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onToggle(group.id)}
      className={`group/header flex min-h-[3.25rem] w-full items-center gap-2 border-2 border-black px-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.32)] transition-colors hover:bg-[#222734] ${
        focused || !collapsed ? 'bg-[#262D3D]' : 'bg-[#1A1F29]'
      }`}
    >
      <span
        className="h-6 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accentColor, filter: focused || !collapsed ? 'brightness(1.1)' : undefined }}
      />
      <span className={`transition-colors ${collapsed ? 'text-[#7E879A] group-hover/header:text-[#B8C2D9]' : 'text-[#7AA2FF]'}`}>
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      </span>
      <span className="text-[1.0625rem] font-semibold text-[#F3F6FC]">{group.label}</span>
      <span className="rounded-[6px] border border-[#313A4D] bg-[#232937] px-2 py-0.5 text-[1.0625rem] font-semibold text-[#C7D2E6] transition-colors group-hover/header:bg-[#2B3447]">
        {group.mods.length}
      </span>
      <span className="min-w-0 truncate text-[1.0625rem] text-[#8D96A8]">{group.description}</span>
    </button>
  );
};
