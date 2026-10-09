import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Keyboard } from 'lucide-react';

import type { KeyBind, KeyboardLocData, KeycapData } from './keymapTypes';

interface KeyboardPreviewProps {
  keybindings: KeyBind[];
  keycaps: KeycapData[];
  keyboardLoc: KeyboardLocData | null;
  localizationLanguage: string;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  getActionDisplayName: (actionName: string) => string;
  getFriendlyKeyName: (keyValue: string) => string;
}

const renderLabelText = (label: string, cx: number, cy: number) => {
  if (!label) return null;
  const parts = label.split('\n');
  if (parts.length === 1) {
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="pointer-events-none select-none fill-current font-minecraft font-bold"
        style={{ fontSize: '0.625rem' }}
      >
        {label}
      </text>
    );
  }

  return (
    <g
      className="pointer-events-none select-none fill-current font-minecraft font-bold"
      style={{ fontSize: '0.5625rem' }}
    >
      <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle">
        {parts[0]}
      </text>
      <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="middle">
        {parts[1]}
      </text>
    </g>
  );
};

export const KeyboardPreview = ({
  keybindings,
  keycaps,
  keyboardLoc,
  localizationLanguage,
  selectedKey,
  onSelectedKeyChange,
  getActionDisplayName,
  getFriendlyKeyName,
}: KeyboardPreviewProps) => {
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [hoveredElement, setHoveredElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const keyToBindsMap = useMemo(() => {
    const bindings = new Map<string, KeyBind[]>();
    for (const keybinding of keybindings) {
      if (!keybinding.key || keybinding.key === 'key.keyboard.none' || keybinding.key === '0') continue;
      const current = bindings.get(keybinding.key) ?? [];
      current.push(keybinding);
      bindings.set(keybinding.key, current);
    }
    return bindings;
  }, [keybindings]);

  useEffect(() => {
    if (!hoveredElement) return;
    const container = hoveredElement.closest('.keyboard-preview-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = hoveredElement.getBoundingClientRect();
    const halfTooltipWidth = 144;
    const minimumLeft = halfTooltipWidth + 8;
    const maximumLeft = containerRect.width - halfTooltipWidth - 8;
    const elementCenter = elementRect.left - containerRect.left + elementRect.width / 2;

    setTooltipPosition({
      top: elementRect.top - containerRect.top - 8,
      left: Math.max(minimumLeft, Math.min(maximumLeft, elementCenter)),
    });
  }, [hoveredElement]);

  const getKeycapStyles = (keyCode: string, isHovered: boolean, isSelected: boolean) => {
    const binds = keyToBindsMap.get(keyCode);
    const isBound = Boolean(binds?.length);
    const isConflicting = (binds?.length ?? 0) > 1;

    let outerFill = '#222224';
    let outerStroke = '#444446';
    let innerFill = '#1c1c1e';
    let innerStroke = '#3a3a3c';
    let textColor = '#8e8e93';

    if (isConflicting) {
      outerFill = '#3E1818';
      outerStroke = isSelected ? '#ffffff' : '#F97316';
      innerFill = '#2D0F0F';
      innerStroke = '#F97316';
      textColor = '#FFB088';
    } else if (isBound) {
      outerFill = '#102613';
      outerStroke = isSelected ? '#ffffff' : '#10B981';
      innerFill = '#1B2A1E';
      innerStroke = '#10B981';
      textColor = '#A7F3D0';
    } else if (isSelected) {
      outerStroke = '#ffffff';
      innerStroke = '#ffffff';
    }

    if (isHovered) outerStroke = '#ffffff';
    return { outerFill, outerStroke, innerFill, innerStroke, textColor };
  };

  const hoveredKeycap = hoveredKey === null ? null : keycaps[hoveredKey];
  const hoveredBindings = hoveredKeycap ? keyToBindsMap.get(hoveredKeycap.keyCode) ?? [] : [];

  return (
    <div className="keyboard-preview-container relative z-30 mb-[1.25rem] w-full select-none rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#141415] p-[0.75rem]">
      <div className="mb-[0.625rem] flex flex-wrap items-center justify-between gap-[0.5rem] px-[0.25rem] text-[1.0625rem] font-bold text-ore-text-muted">
        <div className="flex flex-wrap items-center gap-[0.5rem]">
          <Keyboard size="1.125rem" className="text-ore-green" />
          <span>按键映射与冲突可视化预览</span>
          {keyboardLoc && (
            <span className="ml-[0.5rem] select-none rounded-[2px] bg-black/20 px-[0.5rem] py-[0.125rem] text-[0.875rem] font-normal text-[#8e8e93] animate-fade-in">
              本地化源: {localizationLanguage}.json (v{keyboardLoc.metadata.version} by {keyboardLoc.metadata.authors.join(', ')})
            </span>
          )}
        </div>
        <div className="flex items-center gap-[1rem] text-[0.9375rem] font-normal">
          <div className="flex items-center gap-[0.375rem]">
            <span className="h-[0.75rem] w-[0.75rem] rounded-[2px] border border-[#10B981] bg-[#1B2A1E]" />
            <span>已绑定</span>
          </div>
          <div className="flex items-center gap-[0.375rem]">
            <span className="flex h-[0.75rem] w-[0.75rem] items-center justify-center rounded-[2px] border border-dashed border-[#F97316] bg-[#2D0F0F] text-[0.5rem] font-bold text-[#F97316]">⚠</span>
            <span>有冲突 (⚠ + 虚线)</span>
          </div>
          <div className="flex items-center gap-[0.375rem]">
            <span className="h-[0.75rem] w-[0.75rem] rounded-[2px] border border-[#3a3a3c] bg-[#1c1c1e]" />
            <span>未绑定</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto overflow-y-hidden pb-[0.25rem]">
        <svg
          width="100%"
          height="auto"
          viewBox="0 0 1245 381"
          className="h-auto w-full select-none text-white"
          style={{ minWidth: '900px' }}
        >
          <g transform="translate(10,10)">
            <rect width="1225" height="361" stroke="#2a2a2c" strokeWidth="1" fill="#141415" rx="6" />
            <g transform="translate(5,5)">
              {keycaps.map((keycap) => {
                const isHovered = hoveredKey === keycap.index;
                const isSelected = selectedKey === keycap.keyCode;
                const styles = getKeycapStyles(keycap.keyCode, isHovered, isSelected);
                const binds = keyToBindsMap.get(keycap.keyCode);
                const isConflicting = (binds?.length ?? 0) > 1;
                const centerX = keycap.inner.x + keycap.inner.w / 2;
                const centerY = keycap.inner.y + keycap.inner.h / 2;

                return (
                  <g
                    key={keycap.index}
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => onSelectedKeyChange(isSelected ? null : keycap.keyCode)}
                    onMouseEnter={(event) => {
                      setHoveredKey(keycap.index);
                      setHoveredElement(event.currentTarget);
                    }}
                    onMouseLeave={() => {
                      setHoveredKey(null);
                      setHoveredElement(null);
                    }}
                    style={{
                      filter: isHovered || isSelected ? 'drop-shadow(0 0 4px rgba(64, 181, 58, 0.4))' : 'none',
                    }}
                  >
                    <rect
                      x={keycap.outer.x}
                      y={keycap.outer.y}
                      width={keycap.outer.w}
                      height={keycap.outer.h}
                      rx={keycap.outer.rx}
                      fill={styles.outerFill}
                      stroke={styles.outerStroke}
                      strokeWidth={isSelected || isHovered ? '2' : '1'}
                    />
                    <rect
                      x={keycap.inner.x}
                      y={keycap.inner.y}
                      width={keycap.inner.w}
                      height={keycap.inner.h}
                      rx={keycap.inner.rx}
                      fill={styles.innerFill}
                      stroke={styles.innerStroke}
                      strokeWidth="1"
                      strokeDasharray={isConflicting ? '3 1.5' : undefined}
                    />
                    <g fill={styles.textColor}>{renderLabelText(keycap.label, centerX, centerY)}</g>
                    {isConflicting && (
                      <text
                        x={keycap.inner.x + keycap.inner.w - 5}
                        y={keycap.inner.y + 4}
                        textAnchor="end"
                        dominantBaseline="hanging"
                        className="pointer-events-none select-none fill-[#F97316] font-minecraft font-bold"
                        style={{ fontSize: '0.5625rem' }}
                      >
                        ⚠
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {hoveredKeycap && hoveredElement && (
        <div
          className="pointer-events-none absolute z-[100] w-[18rem] -translate-x-1/2 -translate-y-full rounded-[2px] border-[0.125rem] border-ore-gray-border bg-[#1E1E1F] p-[0.75rem] font-minecraft shadow-ore-glow"
          style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
        >
          <div className="mb-[0.5rem] flex items-center justify-between gap-[1rem] border-b border-ore-gray-border/60 pb-[0.375rem]">
            <span className="text-[1.0625rem] font-bold text-white">{getFriendlyKeyName(hoveredKeycap.keyCode)}</span>
            <span className="font-mono text-[0.875rem] uppercase text-[#8e8e93]">[{hoveredKeycap.label.replace('\n', ' ')}]</span>
          </div>
          {hoveredBindings.length > 0 ? (
            <div className="flex flex-col gap-[0.375rem]">
              {hoveredBindings.length > 1 ? (
                <div className="mb-[0.25rem] flex items-center gap-[0.25rem] text-[0.9375rem] font-bold text-[#F97316] animate-pulse">
                  <AlertTriangle size="0.875rem" />
                  <span>按键冲突！绑定了多个动作：</span>
                </div>
              ) : (
                <div className="mb-[0.25rem] text-[0.9375rem] font-bold text-ore-green">已绑定动作：</div>
              )}
              <div className="flex max-h-[12rem] flex-col gap-[0.25rem] overflow-y-auto pr-[0.25rem]">
                {hoveredBindings.map((binding) => (
                  <div key={binding.name} className="flex flex-col border-l-[0.125rem] border-ore-green/30 py-[0.125rem] pl-[0.5rem]">
                    <span className="text-[1rem] font-bold text-white">{getActionDisplayName(binding.name)}</span>
                    <span className="font-mono text-[0.875rem] text-[#8e8e93]">{binding.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-[0.25rem] text-[0.9375rem] text-[#8e8e93]">未绑定动作</div>
          )}
          <div className="mt-[0.5rem] border-t border-ore-gray-border/40 pt-[0.375rem] text-center text-[0.8125rem] text-[#8e8e93]">
            点击可在列表中筛选此按键
          </div>
        </div>
      )}
    </div>
  );
};
