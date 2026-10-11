import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { JavaSelectorController } from '../hooks/useJavaSelector';
import { getJavaRecommendation } from '../logic/javaDetector';

type JavaSelectionModalController = Pick<
  JavaSelectorController,
  | 'closeMainModal'
  | 'deletingPath'
  | 'getModalDeleteFocusKey'
  | 'getModalItemFocusKey'
  | 'handleBrowseDirectory'
  | 'handleModalLinearArrow'
  | 'handleScan'
  | 'isModalOpen'
  | 'isScanning'
  | 'javaList'
  | 'modalBrowseFocusKey'
  | 'modalScanFocusKey'
  | 'pendingDeleteJava'
  | 'requestDeleteJava'
  | 'selectJava'
>;

interface JavaSelectionModalProps {
  controller: JavaSelectionModalController;
  focusKeyPrefix: string;
  value: string;
}

export const JavaSelectionModal: React.FC<JavaSelectionModalProps> = ({
  controller,
  focusKeyPrefix,
  value,
}) => {
  const { t } = useTranslation();

  return (
    <OreModal
      isOpen={controller.isModalOpen}
      onClose={controller.closeMainModal}
      title={t('settings.java.selector.modalTitle')}
      hideTitleBar
      defaultFocusKey={controller.modalScanFocusKey}
      className="h-[31.25rem] w-[37.5rem]"
      contentClassName="overflow-hidden p-0"
    >
      <FocusBoundary
        id={`${focusKeyPrefix}-selector-boundary`}
        trapFocus={controller.isModalOpen && !controller.pendingDeleteJava}
        onEscape={controller.closeMainModal}
        className="flex h-full flex-col px-5 py-5 outline-none"
      >
        <div className="mb-4 flex shrink-0 gap-3 [.intent-controller_&]:flex-col">
          <OreButton
            focusKey={controller.modalScanFocusKey}
            onArrowPress={controller.handleModalLinearArrow(controller.modalScanFocusKey)}
            onClick={controller.handleScan}
            disabled={controller.isScanning}
            variant="secondary"
            size="auto"
            className="flex-1 !min-w-0 !h-11 !justify-center gap-2"
          >
            <RefreshCw size={16} className={controller.isScanning ? 'animate-spin' : ''} />
            <span>
              {controller.isScanning
                ? t('settings.java.selector.rescanning')
                : t('settings.java.selector.rescan')}
            </span>
          </OreButton>

          <OreButton
            focusKey={controller.modalBrowseFocusKey}
            onArrowPress={controller.handleModalLinearArrow(controller.modalBrowseFocusKey)}
            onClick={controller.handleBrowseDirectory}
            variant="secondary"
            size="auto"
            className="flex-1 !min-w-0 !h-11 !justify-center gap-2"
          >
            <FolderOpen size={16} />
            <span>{t('settings.java.selector.manualBrowse')}</span>
          </OreButton>
        </div>

        <div className="custom-scrollbar -mr-1 flex-1 overflow-y-auto pr-1">
          {controller.isScanning && controller.javaList.length === 0 ? (
            <JavaSelectionEmptyState loading />
          ) : controller.javaList.length === 0 ? (
            <JavaSelectionEmptyState />
          ) : (
            <div className="space-y-3 pb-2 pl-1 pt-1">
              {controller.javaList.map((java, index) => {
                const recommendation = getJavaRecommendation(java.version);
                const itemFocusKey = controller.getModalItemFocusKey(index);
                const deleteFocusKey = controller.getModalDeleteFocusKey(index);
                const isSelected = value === java.path;
                const isDeleting = controller.deletingPath === java.path;

                return (
                  <div key={java.path} className="flex items-stretch gap-2">
                    <FocusItem
                      focusKey={itemFocusKey}
                      onEnter={() => controller.selectJava(java.path)}
                      onArrowPress={controller.handleModalLinearArrow(itemFocusKey)}
                    >
                      {({ ref, focused }) => (
                        <button
                          type="button"
                          ref={ref}
                          onClick={() => controller.selectJava(java.path)}
                          className={`
                            min-w-0 flex flex-1 rounded-[2px] border-2 px-4 py-3 text-left outline-none transition-all duration-150
                            ${isSelected
                              ? 'border-ore-green bg-[var(--ore-modal-header-bg)]/95 brightness-110 shadow-[0_0_0_1px_rgba(56,133,39,0.45),0_0_18px_rgba(56,133,39,0.18)]'
                              : 'border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)] hover:bg-[var(--ore-modal-header-bg)]/88'
                            }
                            ${focused
                              ? 'border-white ring-2 ring-inset ring-[var(--ore-focus-ring)] drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110'
                              : ''
                            }
                          `}
                        >
                          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_9.5rem] gap-x-4 gap-y-2">
                            <div className="min-w-0 self-start">
                              <div className="truncate font-minecraft text-lg leading-tight text-white">
                                Java {java.version}
                              </div>
                            </div>

                            <div className="flex w-[9.5rem] flex-none flex-col items-end gap-1 self-start">
                              {recommendation && (
                                <span className="max-w-full rounded-[2px] border border-[var(--ore-border-color)] bg-[var(--ore-btn-secondary-bg)] px-2 py-0.5 text-right font-minecraft text-[0.625rem] uppercase leading-tight tracking-[0.12em] text-black">
                                  {recommendation}
                                </span>
                              )}
                              {java.managed && (
                                <span className="max-w-full rounded-[2px] border border-ore-green/40 bg-ore-green/15 px-2 py-0.5 text-right font-minecraft text-[0.625rem] uppercase leading-tight tracking-[0.12em] text-ore-green">
                                  {t('settings.java.selector.managed', { defaultValue: '启动器内' })}
                                </span>
                              )}
                            </div>

                            <div className="col-span-2 min-w-0">
                              <span className="block truncate font-minecraft text-sm leading-tight text-ore-text-muted">
                                {java.path}
                              </span>
                            </div>
                          </div>
                        </button>
                      )}
                    </FocusItem>

                    {java.managed && (
                      <FocusItem
                        focusKey={deleteFocusKey}
                        disabled={!!controller.deletingPath}
                        onArrowPress={controller.handleModalLinearArrow(deleteFocusKey)}
                        onEnter={() => controller.requestDeleteJava(java)}
                      >
                        {({ ref, focused }) => (
                          <button
                            ref={ref}
                            type="button"
                            disabled={!!controller.deletingPath}
                            onClick={() => controller.requestDeleteJava(java)}
                            title={t('settings.java.selector.delete', { defaultValue: '删除' })}
                            className={`
                              ore-btn ore-btn-danger flex h-11 w-11 flex-none self-center items-center justify-center rounded-[2px] border-2 p-0 font-minecraft outline-none transition-none
                              !min-w-0 !px-0 text-white [&_svg]:text-white
                              disabled:cursor-not-allowed disabled:opacity-60
                              ${focused ? 'is-focused border-white ring-2 ring-inset ring-[var(--ore-focus-ring)] drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110' : ''}
                            `}
                          >
                            {isDeleting ? (
                              <Loader2 size={17} className="animate-spin" />
                            ) : (
                              <Trash2 size={17} />
                            )}
                          </button>
                        )}
                      </FocusItem>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};

const JavaSelectionEmptyState: React.FC<{ loading?: boolean }> = ({ loading = false }) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[2px] border-2 border-dashed border-[var(--ore-border-color)] bg-[var(--ore-modal-bg)]/55 p-6 text-ore-text-muted">
      {loading ? (
        <Loader2 size={32} className="animate-spin opacity-60" />
      ) : (
        <Search size={32} className="opacity-60" />
      )}
      <span className="font-minecraft text-sm tracking-wide">
        {t(loading ? 'settings.java.selector.scanningDisk' : 'settings.java.selector.notFound')}
      </span>
    </div>
  );
};
