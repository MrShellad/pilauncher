import React from 'react';
import { Boxes, Box, Layers3, Link2, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreToggleButton, type ToggleOption } from '../../../ui/primitives/OreToggleButton';

export type LibraryHeaderView = 'all' | 'mod' | 'mod_set' | 'modpack' | 'external';

interface LibraryHeaderProps {
  activeView: LibraryHeaderView;
  onViewChange: (view: LibraryHeaderView) => void;
  onArrowPress?: (direction: string) => boolean | void;
}

const createViewLabel = (icon: React.ReactNode, label: string) => (
  <span className="flex items-center justify-center gap-2 font-minecraft tracking-wider">
    {icon}
    <span>{label}</span>
  </span>
);

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  activeView,
  onViewChange,
  onArrowPress,
}) => {
  const { t } = useTranslation();
  const viewOptions: ToggleOption[] = [
    { label: createViewLabel(<Boxes className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />, t('libraryPage.views.all')), value: 'all' },
    { label: createViewLabel(<Box className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />, t('libraryPage.views.mod')), value: 'mod' },
    { label: createViewLabel(<Layers3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />, t('libraryPage.views.modSet')), value: 'mod_set' },
    { label: createViewLabel(<Package className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />, t('libraryPage.views.modpack')), value: 'modpack' },
    { label: createViewLabel(<Link2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />, t('libraryPage.views.external')), value: 'external' },
  ];

  return (
    <section className="shrink-0 border-b-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-6 py-4 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
      <div className="mx-auto w-[720px] max-w-full">
        <OreToggleButton
          options={viewOptions}
          value={activeView}
          onChange={(value) => onViewChange(value as LibraryHeaderView)}
          size="lg"
          focusKeyPrefix="library-view-toggle"
          buttonClassName="!text-base"
          onArrowPress={onArrowPress}
        />
      </div>
    </section>
  );
};
