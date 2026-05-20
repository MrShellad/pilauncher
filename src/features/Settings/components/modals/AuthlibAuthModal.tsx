import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, Loader2, LogIn, Server } from 'lucide-react';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { AuthlibFormState } from '../../hooks/useAuthlibAuth';

interface AuthlibAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authlibForm: AuthlibFormState;
  setAuthlibForm: React.Dispatch<React.SetStateAction<AuthlibFormState>>;
  authlibError: string;
  setAuthlibError: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  handleLogin: () => void;
}

const API_INPUT_FOCUS_KEY = 'authlib-api-root';
const USER_INPUT_FOCUS_KEY = 'authlib-username';
const PASSWORD_INPUT_FOCUS_KEY = 'authlib-password';
const CANCEL_BUTTON_FOCUS_KEY = 'authlib-cancel';
const CONFIRM_BUTTON_FOCUS_KEY = 'authlib-confirm';

export const AuthlibAuthModal: React.FC<AuthlibAuthModalProps> = ({
  isOpen,
  onClose,
  authlibForm,
  setAuthlibForm,
  authlibError,
  setAuthlibError,
  isLoading,
  handleLogin,
}) => {
  const { t } = useTranslation();
  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

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
      if (doesFocusableExist(API_INPUT_FOCUS_KEY)) {
        setFocus(API_INPUT_FOCUS_KEY);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [isOpen]);

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

  const updateForm = (patch: Partial<AuthlibFormState>) => {
    setAuthlibError('');
    setAuthlibForm((prev) => ({ ...prev, ...patch }));
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.account.authlib.title')}
      closeOnOutsideClick={!isLoading}
      defaultFocusKey={API_INPUT_FOCUS_KEY}
      actions={
        <div className="flex w-full justify-center gap-3">
          <OreButton
            focusKey={CANCEL_BUTTON_FOCUS_KEY}
            variant="secondary"
            disabled={isLoading}
            onClick={onClose}
            onArrowPress={(direction) => {
              if (direction === 'UP') {
                setFocus(PASSWORD_INPUT_FOCUS_KEY);
                return false;
              }
              if (direction === 'RIGHT') {
                setFocus(CONFIRM_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          >
            {t('settings.account.actions.cancel')}
          </OreButton>
          <OreButton
            focusKey={CONFIRM_BUTTON_FOCUS_KEY}
            variant="primary"
            disabled={isLoading}
            onClick={handleLogin}
            onArrowPress={(direction) => {
              if (direction === 'UP') {
                setFocus(PASSWORD_INPUT_FOCUS_KEY);
                return false;
              }
              if (direction === 'LEFT') {
                setFocus(CANCEL_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> {t('settings.account.authlib.loggingIn')}
              </>
            ) : (
              <>
                <LogIn size={16} className="mr-2" /> {t('settings.account.authlib.login')}
              </>
            )}
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col p-6 sm:p-8">
        <div className="mb-5 flex items-start rounded-sm border-[2px] border-cyan-400/40 bg-cyan-400/10 p-4">
          <Server size={18} className="mr-2 mt-0.5 shrink-0 text-cyan-300" />
          <p className="text-xs font-minecraft leading-relaxed text-cyan-100/80">
            {t('settings.account.authlib.hint')}
          </p>
        </div>

        <OreInput
          focusKey={API_INPUT_FOCUS_KEY}
          label={t('settings.account.authlib.apiRoot')}
          value={authlibForm.apiRoot}
          onChange={(event) => updateForm({ apiRoot: event.target.value })}
          placeholder="https://example.com/api/yggdrasil"
          disabled={isLoading}
          className="font-minecraft text-sm"
          containerClassName="mb-4"
          onArrowPress={(direction) => {
            if (direction === 'DOWN') {
              setFocus(USER_INPUT_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        />

        <OreInput
          focusKey={USER_INPUT_FOCUS_KEY}
          label={t('settings.account.authlib.username')}
          value={authlibForm.username}
          onChange={(event) => updateForm({ username: event.target.value })}
          placeholder={t('settings.account.authlib.usernamePlaceholder')}
          disabled={isLoading}
          className="font-minecraft text-sm"
          containerClassName="mb-4"
          onArrowPress={(direction) => {
            if (direction === 'UP') {
              setFocus(API_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'DOWN') {
              setFocus(PASSWORD_INPUT_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        />

        <OreInput
          focusKey={PASSWORD_INPUT_FOCUS_KEY}
          label={t('settings.account.authlib.password')}
          type="password"
          value={authlibForm.password}
          onChange={(event) => updateForm({ password: event.target.value })}
          placeholder={t('settings.account.authlib.passwordPlaceholder')}
          disabled={isLoading}
          className="font-minecraft text-sm"
          containerClassName="mb-4"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleLogin();
            }
          }}
          onArrowPress={(direction) => {
            if (direction === 'UP') {
              setFocus(USER_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'DOWN') {
              setFocus(CONFIRM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        />

        {authlibError && (
          <div className="mb-4 flex items-start rounded-sm border-[2px] border-red-500/50 bg-red-500/10 p-3">
            <AlertTriangle size={16} className="mr-2 mt-0.5 shrink-0 text-red-400" />
            <span className="text-xs font-minecraft leading-relaxed text-red-300">
              {authlibError}
            </span>
          </div>
        )}

      </div>
    </OreModal>
  );
};
