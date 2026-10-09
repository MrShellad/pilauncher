import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '@/ui/primitives/OreButton';
import { OreModal } from '@/ui/primitives/OreModal';

import type { KeyBind } from './keymapTypes';

interface KeybindEditModalProps {
  keybinding: KeyBind | null;
  onClose: () => void;
  onBindMouse: (mouseKey: string) => void;
  getActionDisplayName: (actionName: string) => string;
}

export const KeybindEditModal = ({
  keybinding,
  onClose,
  onBindMouse,
  getActionDisplayName,
}: KeybindEditModalProps) => {
  const { t } = useTranslation();
  if (!keybinding) return null;

  return (
    <OreModal
      isOpen
      onClose={onClose}
      title={t('instanceDetail.game.editBtn', '更改按键绑定')}
      className="z-[9999] w-[min(29rem,94vw)]"
      contentClassName="p-[1.5rem] text-center font-minecraft"
      actions={
        <div className="flex w-full flex-col gap-[0.75rem] px-[0.25rem] pb-[0.25rem]">
          <div className="grid grid-cols-3 gap-[0.625rem]">
            {[
              ['left', 'mouseLeft', '鼠标左键'],
              ['right', 'mouseRight', '鼠标右键'],
              ['middle', 'mouseMiddle', '鼠标中键'],
            ].map(([button, translationKey, fallback]) => (
              <OreButton
                key={button}
                focusKey={`mouse-btn-${button}`}
                variant="secondary"
                size="full"
                onClick={() => onBindMouse(`key.mouse.${button}`)}
                className="!min-w-0 px-[0.5rem] py-[0.5rem]"
              >
                <span className="truncate text-[1rem]">
                  {t(`instanceDetail.game.${translationKey}`, fallback)}
                </span>
              </OreButton>
            ))}
          </div>
          <OreButton
            focusKey="edit-btn-cancel"
            variant="primary"
            size="full"
            onClick={onClose}
            className="mt-[0.25rem]"
          >
            <span className="text-[1.0625rem]">{t('common.cancel', '取消')}</span>
          </OreButton>
        </div>
      }
    >
      <div className="flex select-none flex-col items-center justify-center gap-[1.25rem] py-[0.5rem]">
        <Keyboard size="3.5rem" className="text-ore-green animate-pulse" />
        <h4 className="text-[1.25rem] font-bold text-white">{getActionDisplayName(keybinding.name)}</h4>
        <p className="text-[1.125rem] text-ore-text-muted">
          {t('instanceDetail.game.pressKey', '请按下一个按键...')}
        </p>
        <div className="max-w-[20rem] rounded-[2px] bg-black/20 px-[1rem] py-[0.5rem] text-[1.0625rem] leading-relaxed text-[#8e8e93]">
          {t('instanceDetail.game.pressKeyDesc', '按下键盘上的按键，或点击下方按钮绑定鼠标。')}
        </div>
      </div>
    </OreModal>
  );
};
