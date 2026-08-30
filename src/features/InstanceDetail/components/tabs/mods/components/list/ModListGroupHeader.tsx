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
  content: '#FFA940',
  uncategorized: '#8B93A7'
};

export const ModListGroupHeader: React.FC<ModListGroupHeaderProps> = ({
  group,
  collapsed,
  listTheme: _listTheme,
  focused = false,
  headerId,
  panelId,
  onToggle
}) => {
  const accentColor = GROUP_ACCENT_COLORS[group.id];

  return (
    <button
      id={headerId}
      type="button"
      tabIndex={-1}
      aria-expanded={!collapsed}
      aria-controls={panelId}
      onClick={() => onToggle(group.id)}
      className={`group/header flex h-9 w-full select-none items-center gap-2.5 border-b-[2px] border-[#16181E] px-3 text-left transition-colors ${
        focused
          ? 'bg-[#333A4A] outline outline-2 outline-white outline-offset-[-2px]'
          : !collapsed
            ? 'bg-[#282D38] hover:bg-[#2E3442]'
            : 'bg-[#1C202A] hover:bg-[#252A36]'
      }`}
    >
      {/* 类别彩色指示条 */}
      <span
        className="h-4 w-1.5 shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      {/* 折叠/展开 箭头 */}
      <motion.span
        className="inline-block text-[#7AA2FF]"
        animate={{ rotate: collapsed ? 0 : 90 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <ChevronRight size={14} strokeWidth={2.5} />
      </motion.span>
      {/* 分组名称 */}
      <span className="font-minecraft text-xs font-bold text-white uppercase tracking-wider">{group.label}</span>
      {/* 数量药丸徽章 */}
      <span className="inline-flex items-center justify-center border-[2px] border-[#16181E] bg-[#12151C] px-2 py-[1px] font-minecraft text-[10px] font-bold leading-tight text-[#7AA2FF]">
        {group.mods.length}
      </span>
      {/* 分组说明 */}
      <span className="min-w-0 truncate font-minecraft text-[11px] text-[#9AA7BD]">{group.description}</span>
    </button>
  );
};
