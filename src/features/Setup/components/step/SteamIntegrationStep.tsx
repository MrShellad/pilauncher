// src/features/Setup/components/step/SteamIntegrationStep.tsx
import React from 'react';
import { Gamepad2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OreButton } from '../../../../ui/primitives/OreButton';

interface SteamIntegrationStepProps {
  onSkip: () => void;
  onRegister: () => void;
  onFinish: () => void;
  isRegistering: boolean;
  registerSuccess: boolean;
  registerError: string | null;
  isGamepadMode: boolean;
  setGamepadModeSettings: () => void;
}

export const SteamIntegrationStep: React.FC<SteamIntegrationStepProps> = ({
  onSkip, onRegister, onFinish, isRegistering, registerSuccess, registerError, isGamepadMode, setGamepadModeSettings
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 blur-3xl pointer-events-none" />
      <Gamepad2 size="3rem" className="text-blue-400 mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">{t('setup.steam.title')}</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        {t('setup.steam.desc1')}<br />
        {t('setup.steam.desc2')}
      </p>

      {registerSuccess ? (
        <div className="w-full flex flex-col items-center">
          <p className="text-green-400 text-sm mb-4">{t('setup.steam.success')}</p>
          {isGamepadMode && (
            <div className="bg-ore-gray-surface p-4 mb-4 rounded-[2px] border-[2px] border-ore-gray-border">
              <p className="text-ore-text-muted text-sm mb-3 text-center">
                {t('setup.steam.gamepadModeDesc')}
              </p>
              <OreButton focusKey="setup-btn-gamepad-mode" onClick={() => { setGamepadModeSettings(); onFinish(); }} variant="primary" size="full" className="mb-2">
                {t('setup.steam.enableGamepadAndFinish')}
              </OreButton>
            </div>
          )}
          <OreButton focusKey="setup-btn-finish" onClick={onFinish} variant="ghost" size="full" className="mt-2">
            {t('setup.steam.finish')}
          </OreButton>
        </div>
      ) : (
        <div className="flex w-full space-x-3 relative z-10">
          <OreButton focusKey="setup-btn-steam-skip" onClick={onSkip} variant="ghost" size="auto" className="flex-1" disabled={isRegistering}>
            {t('setup.steam.skip')}
          </OreButton>
          <OreButton focusKey="setup-btn-steam-register" onClick={onRegister} variant="primary" size="auto" className="flex-1">
            <Play size="1rem" className="mr-2" /> {isRegistering ? t('setup.steam.registering') : t('setup.steam.register')}
          </OreButton>
        </div>
      )}

      {registerError && (
        <p className="text-red-400 text-xs mt-4 text-center w-full relative z-10 bg-red-500/10 p-2 rounded">{registerError}</p>
      )}
    </>
  );
};
