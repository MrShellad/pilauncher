import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Image as ImageIcon, LayoutDashboard, Loader2, Package, Sparkles, Type, Crown } from 'lucide-react';

import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { FormRow } from '../../../../ui/layout/FormRow';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

const PREDEFINED_COLORS = ['#000000', '#FFFFFF', '#18181B', '#2A2A2C', '#3C8527'];

export const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateAppearanceSetting } = useSettingsStore();
  const { appearance } = settings;

  const hasMicrosoftAccount = useAccountStore((state) =>
    state.accounts.some((account) => account.type?.toLowerCase() === 'microsoft'),
  );

  // ── Panorama import state ──
  interface PanoramaSetInfo { name: string; directory: string; faces: string[] }
  const [panoramaSets, setPanoramaSets] = useState<PanoramaSetInfo[]>([]);
  const [selectedPanoramaSet, setSelectedPanoramaSet] = useState('');
  const [isImportingPanorama, setIsImportingPanorama] = useState(false);
  const [panoramaImportError, setPanoramaImportError] = useState<string | null>(null);

  const loadPanoramaSets = useCallback(async () => {
    try {
      const sets = await invoke<PanoramaSetInfo[]>('list_background_panoramas');
      setPanoramaSets(sets);
      if (sets.length > 0 && !selectedPanoramaSet) {
        setSelectedPanoramaSet(sets[0].name);
      }
    } catch (err) {
      console.error('加载全景图列表失败:', err);
    }
  }, [selectedPanoramaSet]);

  useEffect(() => {
    if (hasMicrosoftAccount) {
      void loadPanoramaSets();
    }
  }, [hasMicrosoftAccount, loadPanoramaSets]);

  const handleImportPanorama = async () => {
    setPanoramaImportError(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'MC Resource Pack', extensions: ['zip'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      setIsImportingPanorama(true);
      const packName = await invoke<string>('import_panorama_from_pack', { packPath: selected });
      await loadPanoramaSets();
      setSelectedPanoramaSet(packName);
    } catch (err: any) {
      const msg = String(err);
      setPanoramaImportError(msg);
      console.error('导入全景图失败:', err);
    } finally {
      setIsImportingPanorama(false);
    }
  };

  const panoramaSetOptions = useMemo(
    () => panoramaSets.map((s) => ({ label: s.name, value: s.name })),
    [panoramaSets]
  );

  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = useMemo(() => accounts.find(a => a.uuid === activeAccountId), [accounts, activeAccountId]);
  const [isDonor, setIsDonor] = useState(false);

  useEffect(() => {
    invoke('fetch_donors')
      .then((data) => {
        if (Array.isArray(data) && currentAccount) {
          const found = data.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name);
          setIsDonor(found);
        }
      })
      .catch(console.error);
  }, [currentAccount]);

  const handleSelectCustomLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }],
      });
      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });
        if (appearance.customLogo) {
          try { await invoke('delete_background_image', { path: appearance.customLogo }); } catch (err) {}
        }
        updateAppearanceSetting('customLogo', newPath);
      }
    } catch (err) { console.error('图片选择失败:', err); }
  };

  const handleRemoveCustomLogo = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (appearance.customLogo) {
      try { await invoke('delete_background_image', { path: appearance.customLogo }); } catch (err) {}
    }
    updateAppearanceSetting('customLogo', null);
  };

  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);

  useEffect(() => {
    invoke<string[]>('get_system_fonts')
      .then((fonts) => setSystemFonts(fonts))
      .catch(console.error)
      .finally(() => setIsLoadingFonts(false));
  }, []);

  const handleRemoveImage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (appearance.backgroundImage) {
      try {
        await invoke('delete_background_image', { path: appearance.backgroundImage });
      } catch (err) {
        console.error('彻底删除旧背景图失败:', err);
      }
    }

    updateAppearanceSetting('backgroundImage', null);
  };

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });

        if (appearance.backgroundImage) {
          try {
            await invoke('delete_background_image', { path: appearance.backgroundImage });
          } catch (err) {
            console.error('清理上一张背景图失败:', err);
          }
        }

        updateAppearanceSetting('backgroundImage', newPath);
      }
    } catch (err) {
      console.error('图片选择失败:', err);
    }
  };

  const bgPreviewUrl = useMemo(() => {
    return appearance.backgroundImage ? convertFileSrc(appearance.backgroundImage) : null;
  }, [appearance.backgroundImage]);

  const fontOptions = useMemo(() => {
    const base = [{ label: t('settings.appearance.defaultFont'), value: 'Minecraft' }];
    const sysOpts = systemFonts.map((font) => ({ label: font, value: font }));
    return [...base, ...sysOpts];
  }, [systemFonts, t]);

  const themeOptions = useMemo(
    () => [
      { label: t('settings.appearance.themeOptions.light', '浅色'), value: 'light' },
      { label: t('settings.appearance.themeOptions.dark', '深色'), value: 'dark' },
      { label: t('settings.appearance.themeOptions.system', '跟随系统'), value: 'system' }
    ],
    [t]
  );

  const focusOrder = useMemo(() => {
    const keys: string[] = ['settings-appearance-theme'];

    // --- 1. 静态背景 Section ---
    if (appearance.backgroundImage) {
      keys.push('btn-bg-change', 'btn-bg-remove');
    } else {
      keys.push('btn-bg-add');
    }

    keys.push('settings-appearance-blur');
    PREDEFINED_COLORS.forEach((_, idx) => keys.push(`color-preset-${idx}`));
    keys.push('color-custom');
    keys.push('settings-appearance-opacity');

    // --- 2. 动态背景 Section ---
    if (hasMicrosoftAccount) {
      keys.push('settings-appearance-panorama-enabled');
      if (panoramaSets.length > 0) keys.push('settings-appearance-panorama-set');
      keys.push('settings-appearance-panorama-import');
      keys.push('settings-appearance-panorama-speed');
      keys.push('settings-appearance-panorama-direction');
    }

    // --- 3. 自定义 Logo Section ---
    if (isDonor) {
      if (appearance.customLogo) {
        keys.push('btn-logo-change', 'btn-logo-remove');
        keys.push('settings-appearance-logo-scale');
      } else {
        keys.push('btn-logo-add');
      }
    }

    // --- 4. 排版与个性化 Section ---
    keys.push('settings-appearance-font');
    keys.push('settings-appearance-gradient');

    // --- 5. 导航与行为 Section ---
    keys.push(
      'settings-appearance-nav-instances',
      'settings-appearance-nav-multiplayer',
      'settings-appearance-nav-downloads',
      'settings-appearance-nav-library',
      'settings-appearance-skip-exit-confirm'
    );

    return keys;
  }, [appearance.backgroundImage, appearance.customLogo, hasMicrosoftAccount, panoramaSets.length, isDonor]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout adaptiveScale>
      <SettingsSection title={t('settings.appearance.sections.background', '静态背景')} icon={<ImageIcon size={18} />}>
        <FormRow
          className="relative z-[60]"
          label={t('settings.appearance.theme', '界面主题')}
          description={t('settings.appearance.themeDesc', '切换启动器在浅色模式、深色模式或跟随系统默认主题之间的显示效果。')}
          control={
            <div className="relative focus-within:z-50 w-[240px]">
              <OreDropdown
                focusKey="settings-appearance-theme"
                onArrowPress={handleLinearArrow}
                options={themeOptions}
                value={appearance.theme || 'system'}
                onChange={(val) => updateAppearanceSetting('theme', val as any)}
                className="w-full"
              />
            </div>
          }
        />
        <div className="p-6">
          <div className="group relative flex h-56 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
            {bgPreviewUrl ? (
              <>
                <img
                  src={bgPreviewUrl}
                  alt="Background Preview"
                  className="h-full w-full object-cover transition-all"
                  style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
                />
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <OreButton
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectImage}
                    focusKey="btn-bg-change"
                    onArrowPress={handleLinearArrow}
                  >
                    {t('settings.appearance.btnChangeBg')}
                  </OreButton>
                  <OreButton
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveImage}
                    focusKey="btn-bg-remove"
                    onArrowPress={handleLinearArrow}
                  >
                    {t('settings.appearance.btnRemoveBg')}
                  </OreButton>
                </div>
              </>
            ) : (
              <FocusItem
                focusKey="btn-bg-add"
                onEnter={handleSelectImage}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    tabIndex={-1}
                    onClick={handleSelectImage}
                    className={`flex h-full w-full cursor-pointer flex-col items-center justify-center outline-none transition-all ${
                      focused
                        ? 'border-white bg-white/10 ring-2 ring-inset ring-white'
                        : 'hover:border-ore-green hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`flex flex-col items-center transition-opacity ${
                        focused
                          ? 'text-white opacity-100'
                          : 'text-ore-text-muted opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      <ImageIcon size={40} className="mb-3" />
                      <span className="font-minecraft text-lg">{t('settings.appearance.noBg')}</span>
                      <span className="mt-1 font-minecraft text-xs">{t('settings.appearance.selectLocalInfo')}</span>
                    </div>
                  </div>
                )}
              </FocusItem>
            )}
          </div>
        </div>

        <FormRow
          label={t('settings.appearance.bgBlur')}
          description={t('settings.appearance.bgBlurDesc')}
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-blur"
                onArrowPress={handleLinearArrow}
                value={appearance.backgroundBlur}
                min={0}
                max={30}
                step={1}
                valueFormatter={(v) => `${v}px`}
                onChange={(v) => updateAppearanceSetting('backgroundBlur', v)}
                disabled={
                  !appearance.backgroundImage &&
                  !(hasMicrosoftAccount && appearance.panoramaEnabled)
                }
              />
            </div>
          }
        />



        <FormRow
          label={t('settings.appearance.maskColor')}
          description={t('settings.appearance.maskColorDesc')}
          control={
            <div className="flex items-center space-x-3">
              {PREDEFINED_COLORS.map((color, idx) => (
                <FocusItem
                  key={color}
                  focusKey={`color-preset-${idx}`}
                  onEnter={() => updateAppearanceSetting('maskColor', color)}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      onClick={() => updateAppearanceSetting('maskColor', color)}
                      tabIndex={-1}
                      className={`h-7 w-7 rounded-none border-2 outline-none transition-transform ${
                        appearance.maskColor.toUpperCase() === color
                          ? 'scale-110 border-black shadow-[inset_0_-3px_rgba(0,0,0,0.35),inset_2px_2px_rgba(255,255,255,0.3)]'
                          : 'border-[#58585A] hover:scale-105 shadow-[inset_0_-3px_rgba(0,0,0,0.2),inset_2px_2px_rgba(255,255,255,0.15)]'
                      } ${
                        focused
                          ? 'z-10 scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  )}
                </FocusItem>
              ))}

              <FocusItem
                focusKey="color-custom"
                onEnter={() => document.getElementById('custom-color-input')?.click()}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <label
                    ref={ref as any}
                    tabIndex={-1}
                    className={`relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[#58585A] bg-[#2A2A2C] outline-none transition-all hover:border-ore-green hover:bg-[#3C8527]/10 ${
                      focused
                        ? 'z-10 scale-110 border-white text-white ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
                        : ''
                    }`}
                    title={t('settings.appearance.customColor')}
                  >
                    <input
                      id="custom-color-input"
                      type="color"
                      tabIndex={-1}
                      className="absolute inset-[-10px] h-[50px] w-[50px] cursor-pointer opacity-0"
                      value={appearance.maskColor}
                      onChange={(e) => updateAppearanceSetting('maskColor', e.target.value)}
                    />
                    <span
                      className={`text-[14px] font-bold ${
                        focused ? 'text-white' : 'text-ore-text-muted'
                      }`}
                    >
                      +
                    </span>
                  </label>
                )}
              </FocusItem>
            </div>
          }
        />

        <FormRow
          label={t('settings.appearance.maskOpacity')}
          description={t('settings.appearance.maskOpacityDesc')}
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-opacity"
                onArrowPress={handleLinearArrow}
                value={appearance.maskOpacity}
                min={0}
                max={100}
                step={5}
                valueFormatter={(v) => (v / 100).toFixed(2)}
                onChange={(v) => updateAppearanceSetting('maskOpacity', v)}
              />
            </div>
          }
        />
      </SettingsSection>

      {hasMicrosoftAccount && (
        <SettingsSection title={t('settings.appearance.sections.dynamicBackground', '动态背景')} icon={<ImageIcon size={18} />}>
          <FormRow
            label={t('settings.appearance.panoramaEnabled')}
            description={t('settings.appearance.panoramaEnabledDesc')}
            control={
              <OreSwitch
                focusKey="settings-appearance-panorama-enabled"
                onArrowPress={handleLinearArrow}
                checked={appearance.panoramaEnabled}
                onChange={(v) => updateAppearanceSetting('panoramaEnabled', v)}
              />
            }
          />

          <FormRow
            label="全景图资源"
            description="从 MC 材质包中导入全景图，或选择已导入的全景图组。"
            vertical
            control={
              <div className="flex w-full flex-col gap-3">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  {panoramaSetOptions.length > 0 && (
                    <div className="min-w-0 flex-1">
                      <OreDropdown
                        focusKey="settings-appearance-panorama-set"
                        onArrowPress={handleLinearArrow}
                        options={panoramaSetOptions}
                        value={selectedPanoramaSet}
                        onChange={setSelectedPanoramaSet}
                        placeholder="选择全景图组..."
                        disabled={!appearance.panoramaEnabled}
                      />
                    </div>
                  )}
                  <OreButton
                    focusKey="settings-appearance-panorama-import"
                    onArrowPress={handleLinearArrow}
                    variant="secondary"
                    size="auto"
                    onClick={handleImportPanorama}
                    disabled={!appearance.panoramaEnabled || isImportingPanorama}
                    className="shrink-0 !min-w-[9rem] !h-10 !px-4 !justify-center gap-1.5 whitespace-nowrap"
                  >
                    {isImportingPanorama ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Package size={16} />
                    )}
                    从材质包导入
                  </OreButton>
                </div>
                {panoramaImportError && (
                  <p className="text-sm text-red-400 font-minecraft leading-relaxed">
                    {panoramaImportError}
                  </p>
                )}
                {panoramaSets.length === 0 && !isImportingPanorama && (
                  <p className="text-xs text-ore-text-muted font-minecraft">
                    暂无已导入的全景图。选择包含全景图的 MC 材质包 (.zip) 即可自动提取。
                  </p>
                )}
              </div>
            }
          />

          <FormRow
            label={t('settings.appearance.panoramaSpeed')}
            description={t('settings.appearance.panoramaSpeedDesc')}
            vertical={true}
            control={
              <div className="w-full">
                <OreSlider
                  focusKey="settings-appearance-panorama-speed"
                  onArrowPress={handleLinearArrow}
                  value={appearance.panoramaRotationSpeed}
                  min={0}
                  max={0.12}
                  step={0.002}
                  valueFormatter={(v) => `${v.toFixed(3)} rad/s`}
                  onChange={(v) =>
                    updateAppearanceSetting('panoramaRotationSpeed', Number(v.toFixed(3)))
                  }
                  disabled={!appearance.panoramaEnabled}
                />
              </div>
            }
          />

          <FormRow
            label={t('settings.appearance.panoramaDirection')}
            description={t('settings.appearance.panoramaDirectionDesc', { dir: appearance.panoramaRotationDirection === 'clockwise' ? t('settings.appearance.clockwise') : t('settings.appearance.counterclockwise') })}
            control={
              <OreSwitch
                focusKey="settings-appearance-panorama-direction"
                onArrowPress={handleLinearArrow}
                checked={appearance.panoramaRotationDirection === 'clockwise'}
                onChange={(v) =>
                  updateAppearanceSetting(
                    'panoramaRotationDirection',
                    v ? 'clockwise' : 'counterclockwise',
                  )
                }
                disabled={!appearance.panoramaEnabled}
              />
            }
          />
        </SettingsSection>
      )}
  
      {isDonor && (
        <SettingsSection title="自定义 Logo (赞助者专属)" icon={<Crown size={18} className="text-[#FFD700]" />}>
          <div className="p-6">
            <div className="group relative flex h-32 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
              {appearance.customLogo ? (
                <>
                  <img
                    src={convertFileSrc(appearance.customLogo)}
                    alt="Custom Logo"
                    className="h-full w-full object-contain p-4 transition-all"
                    style={{ transform: `scale(${(appearance.customLogoScale ?? 100) / 100})` }}
                  />
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <OreButton
                      variant="secondary"
                      size="sm"
                      onClick={handleSelectCustomLogo}
                      focusKey="btn-logo-change"
                      onArrowPress={handleLinearArrow}
                    >
                      更换 Logo
                    </OreButton>
                    <OreButton
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveCustomLogo}
                      focusKey="btn-logo-remove"
                      onArrowPress={handleLinearArrow}
                    >
                      移除 Logo
                    </OreButton>
                  </div>
                </>
              ) : (
                <FocusItem
                  focusKey="btn-logo-add"
                  onEnter={handleSelectCustomLogo}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <div
                      ref={ref as any}
                      tabIndex={-1}
                      onClick={handleSelectCustomLogo}
                      className={`flex h-full w-full cursor-pointer flex-col items-center justify-center outline-none transition-all ${
                        focused
                          ? 'border-white bg-white/10 ring-2 ring-inset ring-white'
                          : 'hover:border-ore-green hover:bg-white/5'
                      }`}
                    >
                      <div
                        className={`flex flex-col items-center transition-opacity ${
                          focused
                            ? 'text-white opacity-100'
                            : 'text-ore-text-muted opacity-60 group-hover:opacity-100'
                        }`}
                      >
                        <ImageIcon size={32} className="mb-2" />
                        <span className="font-minecraft text-sm">选择自定义 Logo</span>
                      </div>
                    </div>
                  )}
                </FocusItem>
              )}
            </div>
          </div>
          <FormRow
            label="Logo 大小"
            description="调节自定义 Logo 的缩放比例"
            vertical={true}
            control={
              <div className="w-full">
                <OreSlider
                  focusKey="settings-appearance-logo-scale"
                  onArrowPress={handleLinearArrow}
                  value={appearance.customLogoScale ?? 100}
                  min={10}
                  max={200}
                  step={5}
                  valueFormatter={(v) => `${v}%`}
                  onChange={(v) => updateAppearanceSetting('customLogoScale', v)}
                />
              </div>
            }
          />
        </SettingsSection>
      )}

      <SettingsSection title={t('settings.appearance.sections.typography')} icon={<Sparkles size={18} />}>
        <FormRow
          className="relative z-50"
          label={t('settings.appearance.fontFamily')}
          description={t('settings.appearance.fontFamilyDesc')}
          control={
            <div className="flex items-center space-x-2">
              {isLoadingFonts && <Type size={16} className="animate-pulse text-ore-text-muted" />}
              <div className="relative focus-within:z-50 w-[240px]">
                <OreDropdown
                  focusKey="settings-appearance-font"
                  onArrowPress={handleLinearArrow}
                  options={fontOptions}
                  value={appearance.fontFamily}
                  onChange={(val) => updateAppearanceSetting('fontFamily', val)}
                  disabled={isLoadingFonts}
                  searchable={true}
                  className="w-full"
                />
              </div>
            </div>
          }
        />

        <FormRow
          className="relative z-40"
          label={t('settings.appearance.maskGradient')}
          description={t('settings.appearance.maskGradientDesc')}
          control={
            <OreSwitch
              focusKey="settings-appearance-gradient"
              onArrowPress={handleLinearArrow}
              checked={appearance.maskGradient}
              onChange={(v) => updateAppearanceSetting('maskGradient', v)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.appearance.sections.navigation', '导航与行为')} icon={<LayoutDashboard size={18} />}>
        <FormRow
          label={t('settings.appearance.showInstances', '显示「实例」')}
          description={t('settings.appearance.showInstancesDesc', '在顶部导航栏中显示实例入口')}
          control={
            <OreSwitch
              focusKey="settings-appearance-nav-instances"
              onArrowPress={handleLinearArrow}
              checked={!appearance.hiddenNavTabs.includes('instances')}
              onChange={(v) => {
                const next = v
                  ? appearance.hiddenNavTabs.filter((id) => id !== 'instances')
                  : [...appearance.hiddenNavTabs, 'instances'];
                updateAppearanceSetting('hiddenNavTabs', next);
              }}
            />
          }
        />
        <FormRow
          label={t('settings.appearance.showMultiplayer', '显示「联机」')}
          description={t('settings.appearance.showMultiplayerDesc', '在顶部导航栏中显示联机入口')}
          control={
            <OreSwitch
              focusKey="settings-appearance-nav-multiplayer"
              onArrowPress={handleLinearArrow}
              checked={!appearance.hiddenNavTabs.includes('multiplayer')}
              onChange={(v) => {
                const next = v
                  ? appearance.hiddenNavTabs.filter((id) => id !== 'multiplayer')
                  : [...appearance.hiddenNavTabs, 'multiplayer'];
                updateAppearanceSetting('hiddenNavTabs', next);
              }}
            />
          }
        />
        <FormRow
          label={t('settings.appearance.showDownloads', '显示「下载」')}
          description={t('settings.appearance.showDownloadsDesc', '在顶部导航栏中显示下载入口')}
          control={
            <OreSwitch
              focusKey="settings-appearance-nav-downloads"
              onArrowPress={handleLinearArrow}
              checked={!appearance.hiddenNavTabs.includes('downloads')}
              onChange={(v) => {
                const next = v
                  ? appearance.hiddenNavTabs.filter((id) => id !== 'downloads')
                  : [...appearance.hiddenNavTabs, 'downloads'];
                updateAppearanceSetting('hiddenNavTabs', next);
              }}
            />
          }
        />
        <FormRow
          label={t('settings.appearance.showLibrary', '显示「收藏」')}
          description={t('settings.appearance.showLibraryDesc', '在顶部导航栏中显示收藏入口')}
          control={
            <OreSwitch
              focusKey="settings-appearance-nav-library"
              onArrowPress={handleLinearArrow}
              checked={!appearance.hiddenNavTabs.includes('library')}
              onChange={(v) => {
                const next = v
                  ? appearance.hiddenNavTabs.filter((id) => id !== 'library')
                  : [...appearance.hiddenNavTabs, 'library'];
                updateAppearanceSetting('hiddenNavTabs', next);
              }}
            />
          }
        />
        <FormRow
          label={t('settings.appearance.skipExitConfirm', '跳过退出确认')}
          description={t('settings.appearance.skipExitConfirmDesc', '关闭窗口时不再弹出确认对话框，直接退出应用（仅在关闭行为为「退出」时生效）')}
          control={
            <OreSwitch
              focusKey="settings-appearance-skip-exit-confirm"
              onArrowPress={handleLinearArrow}
              checked={appearance.skipExitConfirm}
              onChange={(v) => updateAppearanceSetting('skipExitConfirm', v)}
            />
          }
        />
      </SettingsSection>
    </SettingsPageLayout>
  );
};
