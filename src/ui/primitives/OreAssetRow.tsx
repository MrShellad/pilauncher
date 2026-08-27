import React from 'react';

import { FocusItem } from '../focus/FocusItem';

interface OreAssetRowProps {
  theme?: 'light' | 'dark';
  selectControl?: React.ReactNode;
  leading?: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  description?: React.ReactNode;
  metaItems?: React.ReactNode[];
  extraColumns?: React.ReactNode;
  trailing?: React.ReactNode;
  focusKey?: string;
  focusable?: boolean;
  focused?: boolean;
  hasFocusedChild?: boolean;
  inactive?: boolean;
  selected?: boolean;
  operationActive?: boolean;
  className?: string;
  leadingClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  trailingClassName?: string;
  onClick?: () => void;
  onEnter?: () => void;
  onFocus?: () => void;
  onArrowPress?: (direction: string) => boolean | void;
}

const renderMetaBadge = (item: React.ReactNode, index: number, isLight: boolean) => (
  <span
    key={index}
    className={`border-[2px] border-[#1E1E1F] px-2 py-0.5 text-[11px] font-minecraft font-bold tracking-wider ${
      isLight ? 'bg-[#E4E5E7] text-[#313233]' : 'bg-[#222224] text-[#D0D1D4]'
    }`}
  >
    {item}
  </span>
);

const OreAssetRowComponent: React.FC<OreAssetRowProps> = ({
  theme = 'dark',
  selectControl,
  leading,
  title,
  badges,
  description,
  metaItems,
  extraColumns,
  trailing,
  focusKey,
  focusable = true,
  focused = false,
  hasFocusedChild = false,
  inactive = false,
  selected = false,
  operationActive = false,
  className = '',
  leadingClassName = '',
  titleClassName = '',
  descriptionClassName = '',
  trailingClassName = '',
  onClick,
  onEnter,
  onFocus,
  onArrowPress
}) => {
  const isLight = theme === 'light';

  const renderInner = (isFocused: boolean, childFocused: boolean) => {
    const isRowActive = isFocused || childFocused;

    return (
      <div
        onClick={onClick}
        className={`
          group relative flex items-center gap-3.5 overflow-hidden border-[2px] border-[#1E1E1F] p-3
          cursor-pointer select-none transition-none
          ${
            isRowActive || operationActive
              ? isLight
                ? 'bg-[#C2C4C9] outline outline-2 outline-[#1E1E1F] outline-offset-[-2px] z-20 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_0_#96989D]'
                : 'bg-[#48494A] outline outline-2 outline-white outline-offset-[-2px] z-20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_rgba(0,0,0,0.3)]'
              : selected
                ? isLight
                  ? 'bg-[#DDE0E3] hover:bg-[#EAECEE] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_0_#B8BBC2]'
                  : 'bg-[#38393A] hover:bg-[#444547] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_rgba(0,0,0,0.25)]'
                : isLight
                  ? 'bg-[#CACCD1] hover:bg-[#DDE0E3] opacity-80 hover:opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_#A9ABAE]'
                  : 'bg-[#2A2B2C] hover:bg-[#38393A] opacity-75 hover:opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-2px_rgba(0,0,0,0.25)]'
          } ${className}
        `}
      >
        {/* 已激活状态的左侧 5px 纯正基岩绿实心条 */}
        {selected && (
          <div className="absolute inset-y-0 left-0 w-[5px] bg-[#3C8527]" />
        )}

        {/* 批量选择控制项 (如 Checkbox) */}
        {selectControl && (
          <div
            className="flex-shrink-0 flex items-center justify-center pl-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {selectControl}
          </div>
        )}

        {leading && (
          <div
            className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] ${
              isLight ? 'bg-[#B8BBC2] shadow-[inset_1px_1px_0_rgba(0,0,0,0.25)]' : 'bg-[#141416] shadow-[inset_1px_1px_rgba(255,255,255,0.08)]'
            } ${
              leadingClassName || 'h-14 w-14'
            } ${inactive ? 'grayscale brightness-75' : ''}`}
          >
            {leading}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate font-minecraft text-[15px] font-bold leading-5 ${
                isLight ? 'text-[#111214]' : 'text-white ore-text-shadow'
              } ${titleClassName}`}
            >
              {title}
            </span>
            {badges}
          </div>

          {description && (
            <div
              className={`mt-1 truncate font-minecraft text-xs leading-snug ${
                isLight ? 'text-[#4D535C]' : 'text-[#D0D1D4]'
              } ${descriptionClassName}`}
            >
              {description}
            </div>
          )}

          {!!metaItems?.length && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {metaItems.map((item, index) => renderMetaBadge(item, index, isLight))}
            </div>
          )}
        </div>

        {extraColumns && (
          <div className="flex-shrink-0 flex items-center gap-3">
            {extraColumns}
          </div>
        )}

        {trailing && (
          <div
            className="flex-shrink-0 flex items-center gap-2.5"
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

export const OreAssetRow = React.memo(OreAssetRowComponent);

