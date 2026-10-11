import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, Search } from 'lucide-react';

import { DirectoryBrowserModal } from '@/ui/components/DirectoryBrowserModal';
import { FocusItem } from '@/ui/focus/FocusItem';
import { OreButton } from '@/ui/primitives/OreButton';
import { OreModal } from '@/ui/primitives/OreModal';
import { OreTag } from '@/ui/primitives/OreTag';
import type { ImportState } from '../hooks/useThirdPartyImport';
import { ThirdPartyImportModal } from './third-party-import/ThirdPartyImportModal';

interface InstancesPageOverlaysProps {
  isDirModalOpen: boolean;
  isImportOptionModalOpen: boolean;
  isTagModalOpen: boolean;
  importState: ImportState;
  isImporting: boolean;
  availableTags: string[];
  selectedTags: string[];
  onCloseDirectoryBrowser: () => void;
  onSelectDirectory: (path: string) => void;
  onCloseImportModal: () => void;
  onConfirmDownloadMissing: () => void;
  onCloseImportOptions: () => void;
  onChooseManualImport: () => void;
  onDetectSources: () => void;
  onCloseTagModal: () => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

export const InstancesPageOverlays: React.FC<InstancesPageOverlaysProps> = ({
  isDirModalOpen,
  isImportOptionModalOpen,
  isTagModalOpen,
  importState,
  isImporting,
  availableTags,
  selectedTags,
  onCloseDirectoryBrowser,
  onSelectDirectory,
  onCloseImportModal,
  onConfirmDownloadMissing,
  onCloseImportOptions,
  onChooseManualImport,
  onDetectSources,
  onCloseTagModal,
  onToggleTag,
  onClearTags,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {isDirModalOpen && (
        <DirectoryBrowserModal
          isOpen={isDirModalOpen}
          onClose={onCloseDirectoryBrowser}
          onSelect={onSelectDirectory}
        />
      )}

      <ThirdPartyImportModal
        importState={importState}
        isImporting={isImporting}
        closeImportModal={onCloseImportModal}
        confirmDownloadMissing={onConfirmDownloadMissing}
      />

      {isImportOptionModalOpen && (
        <OreModal
          isOpen={isImportOptionModalOpen}
          onClose={onCloseImportOptions}
          title={t('instancesPage.importModal.title', '导入第三方实例')}
          className="w-[min(600px,95vw)]"
        >
          <div className="grid grid-cols-1 gap-4 p-4 text-white md:grid-cols-2">
            <FocusItem focusKey="import-option-manual" onEnter={onChooseManualImport}>
              {({ ref, focused }) => (
                <div
                  ref={ref}
                  onClick={onChooseManualImport}
                  className={`
                    flex cursor-pointer select-none flex-col items-center justify-center rounded-sm
                    border-2 border-ore-gray-border bg-[#2B2C2E] p-6 text-center transition-all duration-150
                    hover:scale-[1.02] hover:bg-[#3C3D3F]
                    ${focused ? 'z-10 scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.15)] outline outline-2 outline-white' : ''}
                  `}
                >
                  <FolderPlus size={36} className="mb-3 text-[#6CC349]" />
                  <h3 className="ore-text-shadow mb-2 font-minecraft text-lg font-bold text-white">
                    {t('instancesPage.importModal.manualTitle', '手动选择目录')}
                  </h3>
                  <p className="min-h-[40px] font-minecraft text-xs leading-relaxed text-gray-400">
                    {t(
                      'instancesPage.importModal.manualDesc',
                      '选择本地已有启动器（如 PCL2、HMCL）的实例路径进行关联'
                    )}
                  </p>
                </div>
              )}
            </FocusItem>

            <FocusItem focusKey="import-option-detect" onEnter={onDetectSources}>
              {({ ref, focused }) => (
                <div
                  ref={ref}
                  onClick={onDetectSources}
                  className={`
                    flex cursor-pointer select-none flex-col items-center justify-center rounded-sm
                    border-2 border-ore-gray-border bg-[#2B2C2E] p-6 text-center transition-all duration-150
                    hover:scale-[1.02] hover:bg-[#3C3D3F]
                    ${focused ? 'z-10 scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.15)] outline outline-2 outline-white' : ''}
                  `}
                >
                  <Search size={36} className="mb-3 text-[#6CC349]" />
                  <h3 className="ore-text-shadow mb-2 font-minecraft text-lg font-bold text-white">
                    {t('instancesPage.importModal.detectTitle', '自动探测实例')}
                  </h3>
                  <p className="min-h-[40px] font-minecraft text-xs leading-relaxed text-gray-400">
                    {t(
                      'instancesPage.importModal.detectDesc',
                      '智能扫描系统常见路径下的第三方实例并一键导入'
                    )}
                  </p>
                </div>
              )}
            </FocusItem>
          </div>
        </OreModal>
      )}

      {isTagModalOpen && (
        <OreModal
          isOpen={isTagModalOpen}
          onClose={onCloseTagModal}
          title={t('instancesPage.tagFilterModal.title', '标签筛选')}
          className="w-[min(500px,90vw)]"
        >
          <div className="flex flex-col gap-4 p-2 text-white">
            <p className="font-minecraft text-sm text-ore-text-muted">
              {t(
                'instancesPage.tagFilterModal.description',
                '选择下方的标签来筛选显示的实例列表。'
              )}
            </p>
            {availableTags.length === 0 ? (
              <div className="rounded border-2 border-dashed border-white/10 py-8 text-center text-ore-text-muted">
                {t('instancesPage.tagFilterModal.empty', '目前没有任何可用的标签')}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <FocusItem
                      key={tag}
                      focusKey={`tag-filter-${tag}`}
                      onEnter={() => onToggleTag(tag)}
                    >
                      {({ ref, focused }) => (
                        <div ref={ref}>
                          <OreTag
                            variant={isSelected ? 'primary' : 'neutral'}
                            onClick={() => onToggleTag(tag)}
                            className={`cursor-pointer transition-transform hover:scale-105 ${focused ? 'scale-105 shadow-lg outline outline-2 outline-white' : ''}`}
                          >
                            {tag}
                          </OreTag>
                        </div>
                      )}
                    </FocusItem>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3 border-t-2 border-white/10 pt-4">
              {selectedTags.length > 0 && (
                <FocusItem focusKey="tag-clear" onEnter={onClearTags}>
                  {({ ref, focused }) => (
                    <div ref={ref}>
                      <OreButton
                        variant="secondary"
                        onClick={onClearTags}
                        className={`${focused ? 'ring-2 ring-white' : ''} !m-0`}
                      >
                        {t('instancesPage.tagFilterModal.clear', '清空')}
                      </OreButton>
                    </div>
                  )}
                </FocusItem>
              )}
              <FocusItem focusKey="tag-done" onEnter={onCloseTagModal}>
                {({ ref, focused }) => (
                  <div ref={ref}>
                    <OreButton
                      variant="primary"
                      onClick={onCloseTagModal}
                      className={`${focused ? 'ring-2 ring-white' : ''} !m-0`}
                    >
                      {t('instancesPage.tagFilterModal.done', '完成')}
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>
          </div>
        </OreModal>
      )}
    </>
  );
};
