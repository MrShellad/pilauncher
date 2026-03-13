// src/features/Settings/components/modals/OfflineAuthModal.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, Dice5 } from 'lucide-react';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../ui/primitives/OreModal';

interface OfflineAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  offlineForm: { name: string; isEdit: boolean; oldUuid: string };
  setOfflineForm: React.Dispatch<React.SetStateAction<{ name: string; isEdit: boolean; oldUuid: string }>>;
  offlineError: string;
  setOfflineError: React.Dispatch<React.SetStateAction<string>>;
  handleSaveOffline: () => void;
}

const INPUT_FOCUS_KEY = 'offline-auth-name';
const RANDOM_BUTTON_FOCUS_KEY = 'offline-auth-random';
const CANCEL_BUTTON_FOCUS_KEY = 'offline-auth-cancel';
const CONFIRM_BUTTON_FOCUS_KEY = 'offline-auth-confirm';

const PREFIXES = ['Pixel', 'Nova', 'Block', 'Echo', 'Lucky', 'Frost', 'Luna', 'Iron', 'Swift', 'Cloud'];
const SUFFIXES = ['Fox', 'Wolf', 'Bee', 'Cat', 'Cube', 'Byte', 'Sky', 'Craft', 'Core', 'Ray'];

const createRandomOfflineName = () => {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const number = Math.floor(Math.random() * 90 + 10).toString();
  const raw = `${prefix}_${suffix}${number}`;
  return raw.length <= 16 ? raw : raw.slice(0, 16);
};

export const OfflineAuthModal: React.FC<OfflineAuthModalProps> = ({
  isOpen,
  onClose,
  offlineForm,
  setOfflineForm,
  offlineError,
  setOfflineError,
  handleSaveOffline
}) => {
  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const defaultFocusKey = useMemo(
    () => (offlineForm.isEdit ? INPUT_FOCUS_KEY : RANDOM_BUTTON_FOCUS_KEY),
    [offlineForm.isEdit]
  );

  useEffect(() => {
    if (!isOpen) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (doesFocusableExist(defaultFocusKey)) {
        setFocus(defaultFocusKey);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [defaultFocusKey, isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const timer = setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const updateOfflineName = (name: string) => {
    setOfflineError('');
    setOfflineForm((prev) => ({ ...prev, name }));
  };

  const applyRandomName = () => {
    updateOfflineName(createRandomOfflineName());
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={offlineForm.isEdit ? '配置离线账号' : '创建离线账号'}
      defaultFocusKey={defaultFocusKey}
    >
      <div className="flex flex-col p-6 sm:p-8">
        <label className="mb-2 text-sm font-bold tracking-wider text-ore-text-muted">
          玩家名称 (ID)
        </label>
        <OreInput
          focusKey={INPUT_FOCUS_KEY}
          value={offlineForm.name}
          onChange={(event) => updateOfflineName(event.target.value)}
          placeholder="例如: Steve_123"
          className="mb-2 font-minecraft text-lg"
          maxLength={16}
          onArrowPress={(direction) => {
            if (direction === 'DOWN') {
              setFocus(RANDOM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        />
        <div className="mb-4 text-xs font-minecraft text-gray-500">
          规则：长度 3-16 位，仅允许英文字母、数字及下划线。
        </div>

        <OreButton
          focusKey={RANDOM_BUTTON_FOCUS_KEY}
          variant="secondary"
          size="auto"
          className="mb-6 self-center"
          onClick={applyRandomName}
          onArrowPress={(direction) => {
            if (direction === 'UP') {
              setFocus(INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'DOWN') {
              setFocus(CONFIRM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        >
          <Dice5 size={16} className="mr-2" /> 随机昵称
        </OreButton>

        {offlineForm.isEdit && (
          <div className="mb-6 flex items-start rounded-sm border-[2px] border-yellow-500/50 bg-yellow-500/10 p-4">
            <AlertTriangle size={18} className="mr-2 mt-0.5 shrink-0 text-yellow-500" />
            <p className="text-xs font-minecraft leading-relaxed text-yellow-500/90">
              <strong className="text-yellow-400">警告：</strong>
              修改名称会导致关联 UUID 同步变化。
              <br />
              单机存档和离线服务器会把你识别为一个新的玩家，旧角色背包与进度无法直接继承。
            </p>
          </div>
        )}

        {offlineError && (
          <div className="mb-4 text-xs font-minecraft text-red-400">{offlineError}</div>
        )}

        <div className="mt-4 flex justify-center space-x-3">
          <OreButton
            focusKey={CANCEL_BUTTON_FOCUS_KEY}
            variant="secondary"
            onClick={onClose}
            onArrowPress={(direction) => {
              if (direction === 'UP') {
                setFocus(RANDOM_BUTTON_FOCUS_KEY);
                return false;
              }
              if (direction === 'RIGHT') {
                setFocus(CONFIRM_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          >
            取消
          </OreButton>
          <OreButton
            focusKey={CONFIRM_BUTTON_FOCUS_KEY}
            variant="primary"
            onClick={handleSaveOffline}
            onArrowPress={(direction) => {
              if (direction === 'UP') {
                setFocus(RANDOM_BUTTON_FOCUS_KEY);
                return false;
              }
              if (direction === 'LEFT') {
                setFocus(CANCEL_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          >
            {offlineForm.isEdit ? '确认修改' : '确认创建'}
          </OreButton>
        </div>
      </div>
    </OreModal>
  );
};
