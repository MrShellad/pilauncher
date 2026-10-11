import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';

import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { useJavaSelector } from '../hooks/useJavaSelector';
import { JavaDeleteConfirmModal } from './JavaDeleteConfirmModal';
import { JavaSelectionModal } from './JavaSelectionModal';

interface JavaSelectorProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  isError?: boolean;
  onArrowPress?: (direction: string) => boolean;
  focusKeyPrefix?: string;
}

export const JavaSelector: React.FC<JavaSelectorProps> = ({
  value,
  onChange,
  disabled,
  isError,
  onArrowPress,
  focusKeyPrefix = 'java',
}) => {
  const { t } = useTranslation();
  const controller = useJavaSelector({ value, onChange, disabled, focusKeyPrefix });

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => controller.openSelectorModal(controller.browseButtonFocusKey)}
          onMouseDown={(event) => event.preventDefault()}
        >
          <OreInput
            value={value}
            readOnly
            tabIndex={-1}
            onFocus={(event) => event.currentTarget.blur()}
            placeholder={t('settings.java.selector.placeholder')}
            disabled={disabled}
            className={`pointer-events-none cursor-pointer ${isError ? '!text-red-400 font-bold' : ''}`}
            containerClassName="!space-y-0"
          />
        </div>

        <OreButton
          focusKey={controller.browseButtonFocusKey}
          onArrowPress={onArrowPress}
          variant="secondary"
          onClick={() => controller.openSelectorModal(controller.browseButtonFocusKey)}
          disabled={disabled}
          className="shrink-0 !min-w-[7.5rem] !h-10 !px-4 !justify-center gap-1 whitespace-nowrap"
        >
          <FolderOpen size={14} />
          {t('settings.java.selector.select')}
        </OreButton>
      </div>

      <JavaSelectionModal
        controller={controller}
        focusKeyPrefix={focusKeyPrefix}
        value={value}
      />
      <JavaDeleteConfirmModal controller={controller} focusKeyPrefix={focusKeyPrefix} />

      <DirectoryBrowserModal
        isOpen={controller.isBrowserOpen}
        onClose={() => controller.setIsBrowserOpen(false)}
        onSelect={controller.handleDirSelect}
        initialPath={controller.browserStartPath}
      />
    </>
  );
};
