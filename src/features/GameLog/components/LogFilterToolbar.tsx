// src/features/GameLog/components/LogFilterToolbar.tsx
import React, { useRef, useEffect } from 'react';
import { Search, X, AlertCircle, AlertTriangle, Info, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../ui/focus/FocusItem';

export type LogLevel = 'all' | 'error' | 'warn' | 'info';

interface LogFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeLevel: LogLevel;
  onLevelChange: (level: LogLevel) => void;
  errorCount: number;
  warnCount: number;
  matchCount: number | null;
}

export const LogFilterToolbar: React.FC<LogFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeLevel,
  onLevelChange,
  errorCount,
  warnCount,
  matchCount,
}) => {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 支持 Ctrl+F / Cmd+F 自动聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const levelOptions: { key: LogLevel; label: string; icon: React.ReactNode; count?: number; activeClass: string; badgeClass?: string }[] = [
    {
      key: 'all',
      label: t('gameLog.filter.all', '全部'),
      icon: <Layers size={13} />,
      activeClass: 'bg-white/15 text-white shadow-sm',
    },
    {
      key: 'error',
      label: t('gameLog.filter.errors', '错误'),
      icon: <AlertCircle size={13} className="text-red-400" />,
      count: errorCount,
      activeClass: 'bg-red-950/60 text-red-200 border-red-800/80 shadow-sm',
      badgeClass: 'bg-red-600 text-white',
    },
    {
      key: 'warn',
      label: t('gameLog.filter.warnings', '警告'),
      icon: <AlertTriangle size={13} className="text-amber-400" />,
      count: warnCount,
      activeClass: 'bg-amber-950/60 text-amber-200 border-amber-800/80 shadow-sm',
      badgeClass: 'bg-amber-600 text-black',
    },
    {
      key: 'info',
      label: t('gameLog.filter.info', '信息'),
      icon: <Info size={13} className="text-blue-400" />,
      activeClass: 'bg-blue-950/60 text-blue-200 border-blue-800/80 shadow-sm',
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#18181B]/95 border-b border-white/[0.08] shrink-0 select-none z-10">
      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[200px] max-w-[420px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ore-text-muted pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('gameLog.filter.searchPlaceholder', '搜索日志 (Ctrl+F)...')}
          className="w-full h-7 pl-8 pr-16 bg-[#121214] border border-white/10 rounded-sm text-xs text-white placeholder:text-ore-text-muted/60 focus:outline-none focus:border-ore-green/80 focus:ring-1 focus:ring-ore-green/50 transition-all font-mono"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              className="p-0.5 rounded-sm text-ore-text-muted hover:text-white hover:bg-white/10 transition-colors"
              title="清空"
            >
              <X size={13} />
            </button>
          )}
          {matchCount !== null && (
            <span className="text-[10px] text-ore-text-muted bg-white/5 px-1.5 py-0.5 rounded-sm font-mono whitespace-nowrap">
              {matchCount > 0
                ? t('gameLog.filter.matches', '{{count}} 项匹配', { count: matchCount })
                : t('gameLog.filter.noMatches', '无匹配')}
            </span>
          )}
        </div>
      </div>

      {/* 等级过滤 Chips */}
      <div className="flex items-center gap-1.5 shrink-0">
        {levelOptions.map((opt) => {
          const isActive = activeLevel === opt.key;
          return (
            <FocusItem key={opt.key} focusKey={`log-filter-${opt.key}`} onEnter={() => onLevelChange(opt.key)}>
              {({ ref, focused }) => (
                <button
                  ref={ref as React.Ref<HTMLButtonElement>}
                  type="button"
                  onClick={() => onLevelChange(opt.key)}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-xs font-minecraft border border-white/5 transition-all outline-none ${
                    isActive
                      ? opt.activeClass
                      : 'bg-white/[0.03] text-ore-text-muted hover:text-white hover:bg-white/[0.08]'
                  } ${focused ? 'ring-2 ring-white scale-105' : ''}`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  {typeof opt.count === 'number' && opt.count > 0 && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded-full min-w-[14px] text-center ${
                        opt.badgeClass || 'bg-white/20 text-white'
                      }`}
                    >
                      {opt.count > 99 ? '99+' : opt.count}
                    </span>
                  )}
                </button>
              )}
            </FocusItem>
          );
        })}
      </div>
    </div>
  );
};
