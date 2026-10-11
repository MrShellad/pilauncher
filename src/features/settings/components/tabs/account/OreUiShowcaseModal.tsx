import React, { useState } from 'react';
import { Layers, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreSegmentedControl } from '../../../../../ui/primitives/OreSegmentedControl';
import { OreUiShowcaseButtons } from './OreUiShowcaseButtons';
import { OreUiShowcaseFeedback } from './OreUiShowcaseFeedback';
import { OreUiShowcaseInputs } from './OreUiShowcaseInputs';
import { OreUiShowcaseProgress } from './OreUiShowcaseProgress';
import { OreUiShowcaseSelectors } from './OreUiShowcaseSelectors';
import {
  SHOWCASE_CATEGORIES,
  type ShowcaseCategory,
} from './oreUiShowcaseModel';

interface OreUiShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OreUiShowcaseModal: React.FC<OreUiShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>('buttons');
  const [buttonLoading, setButtonLoading] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [progressValue, setProgressValue] = useState(48);
  const [inputValue, setInputValue] = useState('Minecraft Bedrock');
  const [pinValue, setPinValue] = useState('');
  const [switchA, setSwitchA] = useState(true);
  const [switchB, setSwitchB] = useState(false);
  const [checkboxA, setCheckboxA] = useState(true);
  const [checkboxB, setCheckboxB] = useState(false);
  const [radioValue, setRadioValue] = useState('opt1');
  const [sliderValue, setSliderValue] = useState(75);
  const [segmentValue, setSegmentValue] = useState('mods');
  const [toggleValue, setToggleValue] = useState('list');
  const [dropdownValue, setDropdownValue] = useState('1.21.4');

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.about.componentShowcase.title', {
        defaultValue: 'OreUI 设计规范与组件工坊',
      })}
      defaultFocusKey="showcase-category-tab"
      className="w-full max-w-[980px]"
      contentClassName="p-0 overflow-hidden"
      actions={(
        <div className="flex w-full justify-between items-center px-2">
          <div className="flex items-center gap-2 text-xs text-ore-text-muted font-minecraft">
            <Layers size={14} className="text-ore-green" />
            <span>Minecraft Bedrock OreUI Standard Edition</span>
          </div>
          <OreButton
            focusKey="showcase-close-btn"
            variant="primary"
            size="sm"
            onClick={onClose}
          >
            {t('common.finish', { defaultValue: '完成' })}
          </OreButton>
        </div>
      )}
    >
      <FocusBoundary id="oreui-showcase-boundary" className="flex h-[620px] flex-col outline-none">
        <div className="border-b-[3px] border-[var(--ore-border-color)] bg-[#18181A] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center bg-ore-green text-black border-2 border-[#1E1E1F]">
                <Palette size={18} />
              </div>
              <div>
                <h2 className="text-base font-minecraft text-white">
                  {t('settings.about.componentShowcase.headline', {
                    defaultValue: 'OreUI Design Tokens & Components',
                  })}
                </h2>
                <p className="text-xs text-ore-text-muted">
                  {t('settings.about.componentShowcase.description', {
                    defaultValue: '展示 PiLauncher 内置的基岩版像素物理拟态组件，支持实时交互测试。',
                  })}
                </p>
              </div>
            </div>
          </div>

          <OreSegmentedControl
            tabs={SHOWCASE_CATEGORIES}
            activeTab={activeCategory}
            onChange={(value) => setActiveCategory(value as ShowcaseCategory)}
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#141415] space-y-6">
          {activeCategory === 'buttons' && (
            <OreUiShowcaseButtons
              loading={buttonLoading}
              disabled={buttonDisabled}
              onLoadingChange={setButtonLoading}
              onDisabledChange={setButtonDisabled}
            />
          )}
          {activeCategory === 'progress' && (
            <OreUiShowcaseProgress value={progressValue} onChange={setProgressValue} />
          )}
          {activeCategory === 'inputs' && (
            <OreUiShowcaseInputs
              inputValue={inputValue}
              pinValue={pinValue}
              switchA={switchA}
              switchB={switchB}
              checkboxA={checkboxA}
              checkboxB={checkboxB}
              radioValue={radioValue}
              onInputChange={setInputValue}
              onPinChange={setPinValue}
              onSwitchAChange={setSwitchA}
              onSwitchBChange={setSwitchB}
              onCheckboxAChange={setCheckboxA}
              onCheckboxBChange={setCheckboxB}
              onRadioChange={setRadioValue}
            />
          )}
          {activeCategory === 'selectors' && (
            <OreUiShowcaseSelectors
              segmentValue={segmentValue}
              toggleValue={toggleValue}
              dropdownValue={dropdownValue}
              sliderValue={sliderValue}
              onSegmentChange={setSegmentValue}
              onToggleChange={setToggleValue}
              onDropdownChange={setDropdownValue}
              onSliderChange={setSliderValue}
            />
          )}
          {activeCategory === 'feedback' && <OreUiShowcaseFeedback />}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
