import React from 'react';
import { Radar, Save } from 'lucide-react';

import type { ModrinthProject } from '@/features/resource-catalog';
import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { useFavoritePlaceholder } from '../hooks/useFavoritePlaceholder';
import { FavoritePlaceholderFields } from './FavoritePlaceholderFields';
import { FavoriteProjectSelection } from './FavoriteProjectSelection';
import type { FavoriteResourceType } from './favoritePlaceholderModel';

interface FavoritePlaceholderModalProps {
  isOpen: boolean;
  projects: ModrinthProject[];
  onClose: () => void;
  resourceType?: FavoriteResourceType;
  defaultGameVersion?: string;
  defaultLoader?: string;
  mcVersionOptions?: DropdownOption[];
  onCreated?: () => void;
}

export const FavoritePlaceholderModal: React.FC<FavoritePlaceholderModalProps> = ({
  isOpen,
  projects,
  onClose,
  resourceType = 'mod',
  defaultGameVersion = '',
  defaultLoader = '',
  mcVersionOptions = [],
  onCreated,
}) => {
  const controller = useFavoritePlaceholder({
    isOpen,
    projects,
    resourceType,
    defaultGameVersion,
    defaultLoader,
    mcVersionOptions,
    onClose,
    onCreated,
  });

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={controller.copy.title}
      disableScrollArea
      defaultFocusKey="favorite-save"
      className="h-[min(46rem,calc(100vh-2rem))] w-[72rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)]"
      contentClassName="min-h-0 overflow-visible p-0"
      actions={(
        <>
          {controller.isModFavorite && controller.includeCollection && controller.trackingEnabled && (
            <div className="mr-auto hidden items-center text-xs text-[#6CC349] lg:flex">
              <Radar size={14} className="mr-1" />
              首次检查会在保存后自动开始
            </div>
          )}
          <OreButton focusKey="favorite-cancel" variant="secondary" onClick={onClose}>
            取消
          </OreButton>
          <OreButton
            focusKey="favorite-save"
            variant="primary"
            disabled={!controller.canSave || controller.isSaving}
            onClick={() => { void controller.handleSave(); }}
          >
            <Save size={15} className="mr-2" />
            {controller.isSaving
              ? '保存中...'
              : controller.isModFavorite && controller.includeCollection && controller.trackingEnabled
                ? '保存并追踪'
                : controller.copy.saveText}
          </OreButton>
        </>
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-visible">
        <div className="grid min-h-0 flex-1 gap-0 overflow-visible bg-[#313233] lg:grid-cols-[minmax(0,1fr)_24rem]">
          <FavoritePlaceholderFields {...controller} />
          <FavoriteProjectSelection projects={projects} title={controller.copy.selectedTitle} />
        </div>
      </div>
    </OreModal>
  );
};
