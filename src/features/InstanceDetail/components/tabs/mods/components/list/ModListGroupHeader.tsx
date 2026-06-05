import React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

import { type ModGroupId, type ModListGroup, type ModListTheme } from '../../modListShared';

interface ModListGroupHeaderProps {
  group: ModListGroup;
  collapsed: boolean;
  listTheme: ModListTheme;
  focused?: boolean;
  headerId?: string;
  panelId?: string;
  onToggle: (groupId: ModGroupId) => void;
}

const GROUP_ACCENT_COLORS: Record<ModGroupId, string> = {
  libraries: '#5B8CFF',
  performance: '#57D38C',
  content: '#F5A524',
  uncategorized: '#8B93A7'
};

export const ModListGroupHeader: React.FC<ModListGroupHeaderProps> = ({
  group,
  collapsed,
  listTheme,
  focused = false,
  headerId,
  panelId,
  onToggle
}) => {
  const accentColor = GROUP_ACCENT_COLORS[group.id];
  const isLightTheme = listTheme === 'light';
  const headerClass = isLightTheme
    ? focused || !collapsed
      ? 'bg-[#DDE0E3] hover:bg-[#F2F2F2] text-[#111214]'
      : 'bg-[#C6C8CB] hover:bg-[#D7DADF] text-[#111214]'
    : focused || !collapsed
      ? 'bg-[#262D3D]'
      : 'bg-[#1A1F29]';
  const chevronClass = isLightTheme
    ? collapsed ? 'text-[#4A4C50] group-hover/header:text-[#111214]' : 'text-[#1D4D13]'
    : collapsed ? 'text-[#7E879A] group-hover/header:text-[#B8C2D9]' : 'text-[#7AA2FF]';
  const titleClass = isLightTheme ? 'text-[#111214]' : 'text-[#F3F6FC]';
  const countClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-0.125rem_0_#B8BBC2]'
    : 'border-[#313A4D] bg-[#232937] text-[#C7D2E6] group-hover/header:bg-[#2B3447]';
  const descClass = isLightTheme ? 'text-[#4A4C50]' : 'text-[#8D96A8]';

  return (
    <button
      id={headerId}
      type="button"
      tabIndex={-1}
      aria-expanded={!collapsed}
      aria-controls={panelId}
      onClick={() => onToggle(group.id)}
      className={`group/header flex min-h-[3.25rem] w-full items-center gap-2 border-2 border-black px-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.32)] transition-colors ${headerClass}`}
    >
      <span
        className="h-6 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accentColor, filter: focused || !collapsed ? 'brightness(1.1)' : undefined }}
      />
      <motion.span
        className={`inline-block transition-colors ${chevronClass}`}
        animate={{ rotate: collapsed ? 0 : 90 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <ChevronRight size={15} />
      </motion.span>
      <span className={`text-[1.0625rem] font-semibold ${titleClass}`}>{group.label}</span>
      <span className={`rounded-[6px] border px-2 py-0.5 text-[1.0625rem] font-semibold transition-colors ${countClass}`}>
        {group.mods.length}
      </span>
      <span className={`min-w-0 truncate text-[1.0625rem] ${descClass}`}>{group.description}</span>
    </button>
  );
};
