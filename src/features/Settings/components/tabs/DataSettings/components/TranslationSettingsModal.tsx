import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Save } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreToggleButton } from '../../../../../../ui/primitives/OreToggleButton';
import { useLinearNavigation } from '../../../../../../ui/focus/useLinearNavigation';

interface TranslationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretId: string;
  secretKey: string;
  service: string;
  onSave: (data: { tmtSecretId: string; tmtSecretKey: string; translationService: string }) => void;
}

export const TranslationSettingsModal: React.FC<TranslationSettingsModalProps> = ({
  isOpen,
  onClose,
  secretId,
  secretKey,
  service,
  onSave,
}) => {
  const { t } = useTranslation();

  const [draftService, setDraftService] = useState(service || 'tencent');
  const [draftId, setDraftId] = useState(secretId || '');
  const [draftKey, setDraftKey] = useState(secretKey || '');

  // Reset drafts to current props when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      setDraftService(service || 'tencent');
      setDraftId(secretId || '');
      setDraftKey(secretKey || '');
    }
  }, [isOpen, service, secretId, secretKey]);

  const serviceOptions = useMemo(
    () => [
      { label: t('settings.data.translation.services.tencent', '腾讯翻译'), value: 'tencent' },
      { label: t('settings.data.translation.services.other', '其它 (开发中)'), value: 'other' },
    ],
    [t]
  );

  const focusOrder = useMemo(() => {
    const base = [
      'translation-service-toggle-0',
      'translation-service-toggle-1',
    ];
    if (draftService === 'tencent') {
      base.push('translation-secret-id', 'translation-secret-key');
    }
    base.push('translation-cancel', 'translation-save');
    return base;
  }, [draftService]);

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    'translation-service-toggle-0',
    true,
    isOpen
  );

  const handleSave = () => {
    onSave({
      tmtSecretId: draftId.trim(),
      tmtSecretKey: draftKey.trim(),
      translationService: draftService,
    });
    onClose();
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.translation.modalTitle', '翻译 API 配置')}
      defaultFocusKey="translation-service-toggle-0"
      className="w-[32rem] max-w-[calc(100vw-2rem)]"
      contentClassName="flex flex-col p-6 gap-4"
      actions={(
        <div className="flex w-full justify-center gap-3">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
            focusKey="translation-cancel"
            className="flex-1"
            onArrowPress={handleLinearArrow}
          >
            {t('settings.data.translation.btnCancel', '取消')}
          </OreButton>
          <OreButton
            variant="primary"
            size="full"
            onClick={handleSave}
            focusKey="translation-save"
            className="flex-1"
            onArrowPress={handleLinearArrow}
          >
            <Save size={16} className="mr-1.5" />
            {t('settings.data.translation.btnSave', '保存')}
          </OreButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="font-minecraft font-bold text-white ore-text-shadow text-sm mb-2">
            {t('settings.data.translation.serviceSelect', '选择翻译服务')}
          </div>
          <OreToggleButton
            options={serviceOptions}
            value={draftService}
            onChange={setDraftService}
            focusKeyPrefix="translation-service-toggle"
            size="sm"
            onArrowPress={handleLinearArrow}
          />
        </div>

        {draftService === 'tencent' ? (
          <div className="flex flex-col gap-4 border-t-2 border-[#1E1E1F] pt-4 mt-2">
            <OreInput
              label={t('settings.data.translation.tencentId', '腾讯云 Secret ID')}
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              placeholder="请输入您的 Secret ID"
              focusKey="translation-secret-id"
              onArrowPress={handleLinearArrow}
            />
            <OreInput
              label={t('settings.data.translation.tencentKey', '腾讯云 Secret Key')}
              type="password"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="请输入您的 Secret Key"
              focusKey="translation-secret-key"
              onArrowPress={handleLinearArrow}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#1E1E1F] bg-[#242526] text-ore-text-muted font-minecraft text-sm mt-2">
            <Languages size={32} className="mb-2 text-gray-500" />
            {t('settings.data.translation.comingSoon', '更多翻译服务正在接入中，敬请期待！')}
          </div>
        )}
      </div>
    </OreModal>
  );
};
