import React from 'react';
import { Info, Search, Tag } from 'lucide-react';

import { CreatableCombobox } from '../../../ui/primitives/CreatableCombobox';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { OreSwitch } from '../../../ui/primitives/OreSwitch';
import type { FavoritePlaceholderController } from '../hooks/useFavoritePlaceholder';
import { LOADER_OPTIONS } from './favoritePlaceholderModel';

type FavoritePlaceholderFieldsProps = Pick<
  FavoritePlaceholderController,
  | 'collectionName'
  | 'copy'
  | 'includeCollection'
  | 'isModFavorite'
  | 'matchedCollection'
  | 'modSetOptions'
  | 'notice'
  | 'selectedTagId'
  | 'setCollectionName'
  | 'setIncludeCollection'
  | 'setSelectedTagId'
  | 'setTargetGameVersion'
  | 'setTargetLoader'
  | 'setTrackingEnabled'
  | 'tagCollections'
  | 'targetGameVersion'
  | 'targetLoader'
  | 'trackingEnabled'
  | 'trackingVersionOptions'
>;

export const FavoritePlaceholderFields: React.FC<FavoritePlaceholderFieldsProps> = ({
  collectionName,
  copy,
  includeCollection,
  isModFavorite,
  matchedCollection,
  modSetOptions,
  notice,
  selectedTagId,
  setCollectionName,
  setIncludeCollection,
  setSelectedTagId,
  setTargetGameVersion,
  setTargetLoader,
  setTrackingEnabled,
  tagCollections,
  targetGameVersion,
  targetLoader,
  trackingEnabled,
  trackingVersionOptions,
}) => (
  <OreOverlayScrollArea
    className="min-h-0"
    viewportClassName="overflow-x-visible"
    contentClassName="grid content-start gap-4 p-5 pb-6"
    safeInsetTop={14}
    safeInsetBottom={14}
    safeInsetRight={10}
    contentSafePaddingRight={24}
  >
    <div className="border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3">
      <div className="mb-2 flex items-center gap-2 font-minecraft text-sm text-white">
        <Tag size={15} className="text-[#6CC349]" />
        {copy.tagTitle}
      </div>
      <OreDropdown
        focusKey="favorite-tag"
        options={[
          { label: '不打标签', value: '' },
          ...tagCollections.map((collection) => ({ label: collection.name, value: collection.id })),
        ]}
        value={selectedTagId}
        onChange={setSelectedTagId}
        placeholder={copy.tagPlaceholder}
        searchable={tagCollections.length > 8}
        portal
        panelWidth="trigger"
        lazy
      />
    </div>

    {isModFavorite && (
      <div className={[
        'grid gap-3 border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3',
        includeCollection ? 'md:grid-cols-2' : '',
      ].join(' ')}>
        <div className="flex min-h-10 items-center">
          <OreSwitch
            focusKey="favorite-include-collection"
            checked={includeCollection}
            onChange={setIncludeCollection}
            label={copy.includeCollectionLabel}
          />
        </div>
        {includeCollection && (
          <div className="flex min-h-10 items-center md:justify-end">
            <OreSwitch
              focusKey="modset-enable-tracking"
              checked={trackingEnabled}
              onChange={setTrackingEnabled}
              label="开启版本追踪"
            />
          </div>
        )}
      </div>
    )}

    {isModFavorite && includeCollection && (
      <div className="grid gap-4 border-2 border-[#1E1E1F] bg-[#242526] p-3">
        <div className="relative">
          <CreatableCombobox
            focusKey="modset-combobox"
            label={copy.collectionLabel}
            value={collectionName}
            options={modSetOptions}
            onChange={(option) => {
              setCollectionName(option.label);
            }}
            onCreate={(inputValue) => {
              setCollectionName(inputValue);
            }}
            placeholder={copy.collectionPlaceholder}
            prefixNode={<Search size={15} />}
          />

          <div className="mt-2 text-xs text-[#B1B2B5]">
            {matchedCollection ? copy.matchedText : copy.unmatchedText}
          </div>
        </div>

        {trackingEnabled && (
          <div className="border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 font-minecraft text-sm text-white">目标 Minecraft 版本</div>
                <OreDropdown
                  focusKey="modset-target-version"
                  options={trackingVersionOptions}
                  value={targetGameVersion}
                  onChange={setTargetGameVersion}
                  placeholder="选择版本"
                  searchable
                  portal
                  panelWidth="trigger"
                  lazy
                  lazyBatchSize={36}
                />
              </div>
              <div>
                <div className="mb-1 font-minecraft text-sm text-white">目标 Loader</div>
                <OreDropdown
                  focusKey="modset-target-loader"
                  options={LOADER_OPTIONS}
                  value={targetLoader}
                  onChange={setTargetLoader}
                  placeholder="选择 Loader"
                  portal
                  panelWidth="trigger"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )}

    <div className="flex items-start gap-2 border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3 text-sm leading-6 text-[#D0D1D4]">
      <Info size={16} className="mt-1 shrink-0 text-[#6CC349]" />
      <span>{copy.info}</span>
    </div>

    {notice && (
      <div className="border-2 border-[#7A2323] bg-[#3A1414] p-3 text-sm text-[#F46D6D]">
        {notice}
      </div>
    )}
  </OreOverlayScrollArea>
);
