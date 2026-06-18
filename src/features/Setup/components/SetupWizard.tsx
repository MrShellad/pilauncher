// src/features/Setup/components/SetupWizard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

import { useSetupWizard } from '../../../hooks/useSetupWizard';
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { DirectoryStep } from './step/DirectoryStep';
import { JavaDownloadStep } from './step/JavaDownloadStep';
import { SteamIntegrationStep } from './step/SteamIntegrationStep';
import { LegalAgreementStep } from './step/LegalAgreementStep';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreButton } from '../../../ui/primitives/OreButton';
import { openExternalLink } from '../../../utils/openExternalLink';

const getDefaultFocusKey = (step: 'directory' | 'java_download' | 'steam_integration' | 'legal_agreement') => {
  if (step === 'directory') return 'setup-btn-browse';
  if (step === 'java_download') return 'setup-btn-download';
  if (step === 'steam_integration') return 'setup-btn-steam-register';
  return 'setup-btn-agree';
};

const isSetupFocus = (focusKey: string | null) => {
  if (!focusKey || focusKey === 'SN:ROOT') return false;
  return focusKey === 'setup-wizard-boundary' || focusKey.startsWith('setup-');
};

export const SetupWizard: React.FC = () => {
  const {
    needsSetup, isChecking, error, step,
    basePath, setBasePath, showBrowser, setShowBrowser,
    javaVersion, setJavaVersion, javaProvider, setJavaProvider,
    isRegistering, registerSuccess, registerError, isGamepadMode,
    handleSelectPath, handleConfirmDirectory, handleDownloadJava, handleSkipJava,
    handleRegisterSteam, setGamepadModeSettings, finishSteamIntegration, finalizeSetup
  } = useSetupWizard();

  const { t } = useTranslation();
  const [showDonateModal, setShowDonateModal] = useState(false);

  const lastFocusBeforeWizardRef = useRef<string | null>(null);
  const hasCapturedPreviousFocusRef = useRef(false);

  const defaultFocusKey = useMemo(() => getDefaultFocusKey(step), [step]);

  useEffect(() => {
    if (isChecking || !needsSetup || showBrowser || hasCapturedPreviousFocusRef.current) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT' && !isSetupFocus(currentFocus)) {
      lastFocusBeforeWizardRef.current = currentFocus;
    }
    hasCapturedPreviousFocusRef.current = true;
  }, [isChecking, needsSetup, showBrowser]);

  useEffect(() => {
    if (needsSetup || isChecking) return;

    hasCapturedPreviousFocusRef.current = false;

    const lastFocus = lastFocusBeforeWizardRef.current;
    if (!lastFocus || !doesFocusableExist(lastFocus)) return;

    const timer = setTimeout(() => setFocus(lastFocus), 50);
    return () => clearTimeout(timer);
  }, [needsSetup, isChecking]);

  useEffect(() => {
    if (isChecking || !needsSetup || showBrowser) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let guardTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const maxAttempts = 20;

    const ensureWizardFocus = () => {
      if (disposed) return;

      const currentFocus = getCurrentFocusKey();
      if (isSetupFocus(currentFocus)) return;
      if (!doesFocusableExist(defaultFocusKey)) return;

      setFocus(defaultFocusKey);
    };

    const tryAcquireFocus = () => {
      ensureWizardFocus();

      if (disposed || isSetupFocus(getCurrentFocusKey()) || attempts >= maxAttempts) return;
      attempts += 1;
      retryTimer = setTimeout(tryAcquireFocus, 80);
    };

    retryTimer = setTimeout(tryAcquireFocus, 0);
    guardTimer = setInterval(ensureWizardFocus, 200);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (guardTimer) clearInterval(guardTimer);
    };
  }, [defaultFocusKey, isChecking, needsSetup, showBrowser]);

  if (isChecking || !needsSetup) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 font-minecraft backdrop-blur-md"
        >
          <FocusBoundary
            id="setup-wizard-boundary"
            trapFocus
            isActive={!showBrowser}
            defaultFocusKey={defaultFocusKey}
            className="outline-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative flex w-[33.75rem] flex-col items-center overflow-hidden rounded-[2px] border-[3px] border-ore-gray-border bg-[#18181B] p-8 shadow-2xl"
            >
              {step === 'directory' && (
                <DirectoryStep
                  basePath={basePath}
                  setBasePath={setBasePath}
                  onBrowse={() => setShowBrowser(true)}
                  onConfirm={handleConfirmDirectory}
                />
              )}

              {step === 'java_download' && (
                <JavaDownloadStep
                  javaVersion={javaVersion}
                  setJavaVersion={setJavaVersion}
                  javaProvider={javaProvider}
                  setJavaProvider={setJavaProvider}
                  onSkip={handleSkipJava}
                  onDownload={handleDownloadJava}
                />
              )}

              {step === 'steam_integration' && (
                <SteamIntegrationStep
                  onSkip={finishSteamIntegration}
                  onRegister={handleRegisterSteam}
                  onFinish={finishSteamIntegration}
                  isRegistering={isRegistering}
                  registerSuccess={registerSuccess}
                  registerError={registerError}
                  isGamepadMode={isGamepadMode}
                  setGamepadModeSettings={setGamepadModeSettings}
                />
              )}

              {step === 'legal_agreement' && (
                <LegalAgreementStep
                  onAgree={() => setShowDonateModal(true)}
                />
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative z-10 mt-4 flex w-full items-start border border-red-500/50 bg-red-500/10 p-3 text-left text-xs text-red-400"
                >
                  <AlertTriangle size="0.875rem" className="mr-2 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </motion.div>
          </FocusBoundary>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showBrowser && (
          <DirectoryBrowserModal
            isOpen={showBrowser}
            onClose={() => setShowBrowser(false)}
            onSelect={handleSelectPath}
            initialPath={basePath}
          />
        )}
      </AnimatePresence>

      <OreModal
        isOpen={showDonateModal}
        onClose={() => {
          setShowDonateModal(false);
          finalizeSetup();
        }}
        title={t('setup.donate.title')}
        hideCloseButton
        closeOnOutsideClick={false}
        defaultFocusKey="setup-donate-finish"
        wrapperClassName="z-[10000]"
        className="w-[440px]"
        actions={
          <div className="flex w-full gap-3">
            <OreButton
              focusKey="setup-donate-link"
              variant="secondary"
              onClick={() => void openExternalLink('https://ifdian.net/u/f60602b4004811eea0bf52540025c377')}
              size="full"
              className="flex-1"
            >
              <Heart size={16} className="mr-2 text-red-500 fill-red-500" />
              {t('setup.donate.btnDonate')}
            </OreButton>
            <OreButton
              focusKey="setup-donate-finish"
              variant="primary"
              onClick={() => {
                setShowDonateModal(false);
                finalizeSetup();
              }}
              size="full"
              className="flex-1"
            >
              {t('setup.donate.btnFinish')}
            </OreButton>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center p-2 font-minecraft">
          <p className="text-sm leading-relaxed text-ore-text-muted mb-6">
            {t('setup.donate.description')}
          </p>

          <div className="bg-white p-3 rounded-lg border-2 border-white/10 shadow-[0_0_20px_rgba(148,108,230,0.25)] mb-3 relative scale-100 transition-transform">
            <QRCodeSVG value="https://ifdian.net/u/f60602b4004811eea0bf52540025c377" size={130} />
          </div>

          <span className="text-xs text-ore-text-muted mb-2">
            {t('setup.donate.scanOrClick')}
          </span>
        </div>
      </OreModal>
    </>
  );
};
