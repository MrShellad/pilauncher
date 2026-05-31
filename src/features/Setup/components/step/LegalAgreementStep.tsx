import React, { useMemo } from 'react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../../store/useSettingsStore';
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

  const EulaComponent = useMemo(() => {
    return ['zh-CN', 'zh-TW', 'zh-HK'].includes(i18n.language) ? EulaZh : EulaEn;
  }, [i18n.language]);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex flex-col items-center">
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

      <div className="relative mb-6 block w-[30rem] h-[18.75rem] overflow-hidden rounded-[2px] border-[3px] border-black bg-[#0f1115]">
        <div className="h-full w-full overflow-y-auto p-5 text-[#cfcfcf] custom-scrollbar text-xs leading-[1.7] select-text">
          <EulaComponent currentDate={CURRENT_EULA_DATE} />
        </div>
        {/* Scroll shadow indicator overlay to look more integrated */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0f1115] to-transparent"></div>
      </div>

      <div className="flex w-full flex-col items-center space-y-3">
        <OreButton
          focusKey="setup-btn-agree"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onAgree}
        >
          <CheckCircle2 size="1.125rem" className="mr-2" />
          {t('setup.legal.agree')}
        </OreButton>
      </div>
    </div>
  );
};
