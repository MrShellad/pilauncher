import React, { useCallback, useState } from 'react';
import { Boxes, Box, Layers3, Link2, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreToggleButton, type ToggleOption } from '../../../ui/primitives/OreToggleButton';
import { ControlHint } from '../../../ui/components/ControlHint';
import { useInputAction } from '../../../ui/focus/InputDriver';

export type LibraryHeaderView = 'all' | 'mod' | 'mod_set' | 'modpack' | 'external';

interface LibraryHeaderProps {
  activeView: LibraryHeaderView;
  onViewChange: (view: LibraryHeaderView) => void;
}

const createViewLabel = (icon: React.ReactNode, label: string) => (
  <div className="flex min-w-0 items-center justify-center gap-2">
    {icon}
    <span className="min-w-0 truncate font-minecraft tracking-wider">{label}</span>
  </div>
);

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  activeView,
  onViewChange,
}) => {
  const { t } = useTranslation();
  const [pressingLT, setPressingLT] = useState(false);
  const [pressingRT, setPressingRT] = useState(false);

  const viewOptions: ToggleOption[] = [
    { label: createViewLabel(<Boxes className="h-4 w-4 shrink-0" />, t('libraryPage.views.all')), value: 'all' },
    { label: createViewLabel(<Box className="h-4 w-4 shrink-0" />, t('libraryPage.views.mod')), value: 'mod' },
    { label: createViewLabel(<Layers3 className="h-4 w-4 shrink-0" />, t('libraryPage.views.modSet')), value: 'mod_set' },
    { label: createViewLabel(<Package className="h-4 w-4 shrink-0" />, t('libraryPage.views.modpack')), value: 'modpack' },
    { label: createViewLabel(<Link2 className="h-4 w-4 shrink-0" />, t('libraryPage.views.external')), value: 'external' },
  ];

  const handleSwitchTab = useCallback((direction: -1 | 1) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

    if (direction === -1) {
      setPressingLT(true);
      setTimeout(() => setPressingLT(false), 150);
    } else {
      setPressingRT(true);
      setTimeout(() => setPressingRT(false), 150);
    }

    const currentIndex = viewOptions.findIndex((t) => t.value === activeView);
    const nextIndex = (currentIndex + direction + viewOptions.length) % viewOptions.length;
    onViewChange(viewOptions[nextIndex].value as LibraryHeaderView);
  }, [activeView, onViewChange, viewOptions]);

  useInputAction('PAGE_LEFT', () => handleSwitchTab(-1));
  useInputAction('PAGE_RIGHT', () => handleSwitchTab(1));

  return (
    <section className="shrink-0 border-b-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-[clamp(16px,2vw,32px)] py-[clamp(12px,1.6vh,20px)] shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
      <div className="mx-auto grid w-full max-w-[120rem] grid-cols-[clamp(42px,4vw,64px)_minmax(0,1fr)_clamp(42px,4vw,64px)] items-center gap-[clamp(10px,1.4vw,20px)]">
        <div
          className={`flex cursor-pointer items-center justify-center transition-transform duration-150 ${
            pressingLT ? 'scale-75' : 'scale-90 hover:scale-100 active:scale-75'
          }`}
          onClick={() => handleSwitchTab(-1)}
        >
          <ControlHint label="LT" variant="trigger" tone={pressingLT ? 'green' : 'neutral'} />
        </div>

        <div className="min-w-0 overflow-hidden">
          <div className="flex min-w-0 justify-center">
            <OreToggleButton
              options={viewOptions}
              value={activeView}
              onChange={(value) => onViewChange(value as LibraryHeaderView)}
              size="lg"
              uiScale="adaptive"
              focusable={false}
              className="w-full ore-tab-nav-toggle max-w-[55rem]"
            />
          </div>
        </div>

        <div
          className={`flex cursor-pointer items-center justify-center transition-transform duration-150 ${
            pressingRT ? 'scale-75' : 'scale-90 hover:scale-100 active:scale-75'
          }`}
          onClick={() => handleSwitchTab(1)}
        >
          <ControlHint label="RT" variant="trigger" tone={pressingRT ? 'green' : 'neutral'} />
        </div>
      </div>
    </section>
  );
};
