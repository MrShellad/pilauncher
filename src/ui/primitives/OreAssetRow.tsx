import React from 'react';

import { FocusItem } from '../focus/FocusItem';

interface OreAssetRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  description?: React.ReactNode;
  metaItems?: React.ReactNode[];
  trailing?: React.ReactNode;
  focusKey?: string;
  focusable?: boolean;
  focused?: boolean;
  hasFocusedChild?: boolean;
  inactive?: boolean;
  selected?: boolean;
  operationActive?: boolean;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  trailingClassName?: string;
  onClick?: () => void;
  onEnter?: () => void;
  onFocus?: () => void;
  onArrowPress?: (direction: string) => boolean | void;
}

const renderMetaBadge = (item: React.ReactNode, index: number) => (
  <span
    key={index}
    className="border-[2px] px-2 py-0.5 text-[#111111]"
    style={{
      backgroundColor: index === 0 ? 'rgba(255, 255, 255, 0.52)' : 'rgba(255, 255, 255, 0.44)',
      borderColor: 'var(--ore-downloadDetail-divider)'
    }}
  >
    {item}
  </span>
);

export const OreAssetRow: React.FC<OreAssetRowProps> = ({
  leading,
  title,
  badges,
  description,
  metaItems,
  trailing,
  focusKey,
  focusable = true,
  focused = false,
  hasFocusedChild = false,
  inactive = false,
  selected = false,
  operationActive = false,
  className = '',
  titleClassName = '',
  descriptionClassName = '',
  trailingClassName = '',
  onClick,
  onEnter,
  onFocus,
  onArrowPress
}) => {
  const renderInner = (isFocused: boolean, childFocused: boolean) => {
    const isRowActive = isFocused || childFocused;
    const rowBoxShadow = operationActive
      ? 'var(--ore-downloadDetail-installedShadow)'
      : 'var(--ore-downloadDetail-rowShadow)';
    const rowBackground = operationActive
      ? 'var(--ore-downloadDetail-installedBg)'
      : 'var(--ore-downloadDetail-rowBg)';
    const accentClass = isRowActive || operationActive
      ? 'bg-[var(--ore-downloadDetail-installedAccent)]'
      : selected
        ? 'bg-[var(--ore-btn-primary-bg)]'
        : 'bg-[var(--ore-downloadDetail-idleAccent)]';
    const rowOutlineClass = isRowActive || operationActive
      ? 'z-20 outline outline-2 outline-white outline-offset-[3px]'
      : '';
    const rowToneClass = operationActive
      ? 'brightness-[0.9] saturate-[1.05]'
      : isRowActive
        ? 'brightness-[0.88]'
        : 'hover:brightness-[0.94]';

    return (
      <div
        onClick={onClick}
        className={`
          group relative flex items-center gap-3 overflow-hidden rounded-sm border-[2px] px-4 py-2.5
          cursor-pointer select-none transition-[filter,outline-color,box-shadow,opacity] duration-150
          focus-within:z-20 focus-within:outline focus-within:outline-2 focus-within:outline-white focus-within:outline-offset-[3px]
          ${rowOutlineClass} ${rowToneClass} ${inactive ? 'opacity-60 grayscale-[0.5]' : ''} ${className}
        `}
        style={{
          backgroundColor: rowBackground,
          borderColor: 'var(--ore-downloadDetail-divider)',
          boxShadow: rowBoxShadow
        }}
      >
        <div className={`absolute inset-y-0 left-0 w-2 ${accentClass}`} />
        
        {/* 禁用状态的半透明遮罩 */}
        {inactive && (
          <div className="absolute inset-0 pointer-events-none bg-black/10 z-[1]" />
        )}

        {leading && (
          <div
            className={`relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border-[2px] ${
              inactive ? 'grayscale brightness-75' : ''
            }`}
            style={{
              backgroundColor: 'var(--ore-downloadDetail-base)',
              borderColor: 'var(--ore-downloadDetail-divider)',
              boxShadow: 'var(--ore-downloadDetail-sectionInset)'
            }}
          >
            {leading}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`truncate font-minecraft text-[17px] font-bold leading-5 ${isRowActive ? 'text-black' : 'text-[#1E1E1F]'} ${titleClassName}`}>
              {title}
            </span>
            {badges}
          </div>

          {description && (
            <div className={`mt-1 truncate text-[13px] leading-snug text-[#2A2A2C] ${descriptionClassName}`}>
              {description}
            </div>
          )}

          {!!metaItems?.length && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
              {metaItems.map((item, index) => renderMetaBadge(item, index))}
            </div>
          )}
        </div>

        {trailing && (
          <div
            className="flex-shrink-0 border-[2px] p-2"
            style={{
              backgroundColor: 'var(--ore-downloadDetail-surface)',
              borderColor: 'var(--ore-downloadDetail-divider)',
              boxShadow: 'var(--ore-downloadDetail-sectionInset)'
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className={trailingClassName}>
              {trailing}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!focusable) {
    return renderInner(focused, hasFocusedChild);
  }

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={onEnter ?? onClick}
      onFocus={onFocus}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused: itemFocused, hasFocusedChild: childFocused }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          {renderInner(itemFocused, childFocused)}
        </div>
      )}
    </FocusItem>
  );
};
