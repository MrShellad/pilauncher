import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { JavaSelectorController } from '../hooks/useJavaSelector';

type JavaDeleteController = Pick<
  JavaSelectorController,
  | 'cancelDeleteFocusKey'
  | 'closeDeleteModal'
  | 'confirmDeleteFocusKey'
  | 'deleteError'
  | 'deletingPath'
  | 'handleDeleteJava'
  | 'pendingDeleteJava'
>;

interface JavaDeleteConfirmModalProps {
  controller: JavaDeleteController;
  focusKeyPrefix: string;
}

export const JavaDeleteConfirmModal: React.FC<JavaDeleteConfirmModalProps> = ({
  controller,
  focusKeyPrefix,
}) => {
  const { t } = useTranslation();

  return (
    <OreModal
      isOpen={!!controller.pendingDeleteJava}
      onClose={controller.closeDeleteModal}
      hideTitleBar
      defaultFocusKey={controller.cancelDeleteFocusKey}
      className="w-full max-w-md"
    >
      <FocusBoundary
        id={`${focusKeyPrefix}-delete-java-boundary`}
        trapFocus={!!controller.pendingDeleteJava}
        onEscape={controller.closeDeleteModal}
        className="outline-none"
      >
        <div className="flex flex-col items-center p-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[2px] border-2 border-red-500/40 bg-red-500/15 text-red-300">
            <AlertTriangle size={28} />
          </div>
          <h3 className="mb-2 font-minecraft text-xl text-white">
            {t('settings.java.selector.deleteConfirmTitle', { defaultValue: '确认删除 Java' })}
          </h3>
          <p className="mb-3 text-sm leading-relaxed text-ore-text-muted">
            {t('settings.java.selector.deleteConfirmDesc', {
              defaultValue: '只会删除启动器自动下载到 runtime/java 内的 Java，不会删除外部安装的 Java。',
            })}
          </p>
          {controller.pendingDeleteJava && (
            <div className="mb-4 w-full rounded-[2px] border border-[var(--ore-border-color)] bg-black/20 p-3 text-left">
              <div className="font-minecraft text-sm text-white">
                Java {controller.pendingDeleteJava.version}
              </div>
              <div className="mt-1 break-all text-xs text-ore-text-muted">
                {controller.pendingDeleteJava.path}
              </div>
            </div>
          )}
          {controller.deleteError && (
            <div className="mb-4 w-full text-left text-sm text-red-300">
              {controller.deleteError}
            </div>
          )}

          <div className="flex w-full gap-3">
            <OreButton
              focusKey={controller.cancelDeleteFocusKey}
              variant="secondary"
              onClick={controller.closeDeleteModal}
              disabled={!!controller.deletingPath}
              className="flex-1 !justify-center"
            >
              {t('common.cancel', { defaultValue: '取消' })}
            </OreButton>
            <OreButton
              focusKey={controller.confirmDeleteFocusKey}
              variant="primary"
              onClick={() => void controller.handleDeleteJava()}
              disabled={!!controller.deletingPath}
              className="flex-1 !justify-center gap-2 !bg-red-600 hover:!bg-red-500"
            >
              {controller.deletingPath ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {t('settings.java.selector.confirmDelete', { defaultValue: '确认删除' })}
            </OreButton>
          </div>
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
