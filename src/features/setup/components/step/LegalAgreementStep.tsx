import React, { useMemo, useRef, useState } from 'react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';
import { exit } from '@tauri-apps/plugin-process';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { CURRENT_EULA_DATE } from '../../../../hooks/useSetupWizard';
import { EulaZh } from './eula/EulaZh';
import { EulaEn } from './eula/EulaEn';

interface LegalAgreementStepProps {
  onAgree: () => void;
}

export const LegalAgreementStep: React.FC<LegalAgreementStepProps> = ({ onAgree }) => {
  const { t, i18n } = useTranslation();
  const lastAgreedDate = useSettingsStore(state => state.settings.general.lastAgreedLegalDate);
  const isUpdate = lastAgreedDate !== '' && lastAgreedDate !== CURRENT_EULA_DATE;
  const [completedLanguage, setCompletedLanguage] = useState<string | null>(null);
  const hasReadAgreement = completedLanguage === i18n.language;
  const agreementViewportRef = useRef<HTMLDivElement | null>(null);

  const EulaComponent = useMemo(() => {
    return ['zh-CN', 'zh-TW', 'zh-HK'].includes(i18n.language) ? EulaZh : EulaEn;
  }, [i18n.language]);

  const handleAgreementScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (distanceFromBottom <= 8) {
      setCompletedLanguage(i18n.language);
    }
  };

  const handleAgreementArrow = (direction: string) => {
    const viewport = agreementViewportRef.current;
    if (!viewport) return true;

    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    if (direction === 'up' && viewport.scrollTop > 0) {
      viewport.scrollTop = Math.max(0, viewport.scrollTop - 72);
      return false;
    }
    if (direction === 'down' && viewport.scrollTop < maxScrollTop - 1) {
      viewport.scrollTop = Math.min(maxScrollTop, viewport.scrollTop + 72);
      return false;
    }
    return true;
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center min-h-0">
      <div className="mb-4 shrink-0 flex flex-col items-center">
        <div className="mb-2 rounded-full bg-[#3C8527]/20 p-3">
          <FileText className="text-[#3C8527]" size="1.75rem" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-widest">{t('setup.legal.title')}</h2>
        <p className="mt-1 text-center text-[0.8rem] text-gray-400">
          {t('setup.legal.subtitle')}
        </p>
      </div>

      {isUpdate && (
        <div className="mb-3 w-full rounded border border-[#EAB308]/50 bg-[#EAB308]/10 p-2 text-center text-[0.75rem] text-[#EAB308]">
          {t('setup.legal.updateWarning')}
        </div>
      )}

      <FocusItem focusKey="setup-legal-scrollarea" onArrowPress={handleAgreementArrow}>
        {({ ref, focused, tabIndex }) => (
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            tabIndex={tabIndex}
            role="region"
            aria-label={t('setup.legal.title')}
            className={`relative mb-2 h-[25rem] min-h-[12rem] min-w-0 w-full max-w-[42rem] shrink overflow-hidden rounded-[2px] border-[3px] bg-[#0f1115] ${
              focused ? 'border-white outline outline-2 outline-[#6CC349]' : 'border-black'
            }`}
          >
            <OreOverlayScrollArea
              ref={agreementViewportRef}
              className="h-full min-h-0 w-full"
              viewportClassName="h-full overscroll-contain"
              contentClassName="p-6 text-sm leading-[1.75] text-[#cfcfcf] select-text"
              contentSafePaddingRight={24}
              safeInsetTop={10}
              safeInsetBottom={10}
              safeInsetRight={6}
              onScroll={handleAgreementScroll}
            >
              <EulaComponent currentDate={CURRENT_EULA_DATE} />
            </OreOverlayScrollArea>
            {/* Scroll shadow indicator overlay to look more integrated */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0f1115] to-transparent"></div>
          </div>
        )}
      </FocusItem>

      <p
        id="legal-read-status"
        className={`mb-3 text-center text-[0.75rem] ${hasReadAgreement ? 'text-[#6CC349]' : 'text-[#EAB308]'}`}
        aria-live="polite"
      >
        {t(hasReadAgreement ? 'setup.legal.readComplete' : 'setup.legal.readToEndHint')}
      </p>

      <div className="flex w-full gap-3">
        <OreButton
          focusKey="setup-btn-decline"
          variant="danger"
          size="lg"
          className="flex-1"
          onClick={() => void exit(0)}
        >
          <XCircle size="1.125rem" className="mr-2" />
          {t('setup.legal.decline')}
        </OreButton>
        <OreButton
          focusKey="setup-btn-agree"
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={onAgree}
          disabled={!hasReadAgreement}
          aria-describedby="legal-read-status"
        >
          <CheckCircle2 size="1.125rem" className="mr-2" />
          {t('setup.legal.agree')}
        </OreButton>
      </div>
    </div>
  );
};
