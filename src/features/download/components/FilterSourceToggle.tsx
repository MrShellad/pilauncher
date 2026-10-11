import React from 'react';
import type { ToggleOption } from '../../../ui/primitives/OreToggleButton';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import type { DownloadSource } from '../hooks/useResourceDownload';
import type { FilterArrowHandler } from './filterBarModel';
import { filterSourceToggleClassName } from './filterBarStyles';

interface FilterSourceToggleProps {
  source: DownloadSource;
  setSource: (value: DownloadSource) => void;
  sourceOptions: ToggleOption[];
  handleFilterArrow: FilterArrowHandler;
  roundedFocus?: boolean;
}

export const FilterSourceToggle: React.FC<FilterSourceToggleProps> = ({
  source,
  setSource,
  sourceOptions,
  handleFilterArrow,
  roundedFocus = false,
}) => (
  <FocusItem
    focusKey="filter-source-toggle"
    onArrowPress={handleFilterArrow('filter-source-toggle')}
    onEnter={() => setSource(source === 'modrinth' ? 'curseforge' : 'modrinth')}
  >
    {({ ref, focused }) => (
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={focused
          ? `outline outline-[0.125rem] outline-offset-[0.1875rem] outline-white ${roundedFocus ? 'rounded' : ''}`
          : ''}
      >
        <OreToggleButton
          options={sourceOptions}
          value={source}
          onChange={(value) => setSource(value as DownloadSource)}
          focusable={false}
          className={filterSourceToggleClassName}
          size="sm"
        />
      </div>
    )}
  </FocusItem>
);
