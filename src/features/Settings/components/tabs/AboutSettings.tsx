import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { Info, Github, Heart, Users, ExternalLink, Tv, Zap, Crown, PackageOpen } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { QRCodeSVG } from 'qrcode.react';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { openExternalLink } from '../../../../utils/openExternalLink';
import { DonorSkinModal, getDonorTierColor } from './AS/DonorSkinModal';
import type { DonorInfo } from './AS/DonorSkinModal';

type OpenSourceProjectGroup = 'frontend' | 'backend' | 'ecosystem';

interface OpenSourceProject {
  name: string;
  url: string;
  group: OpenSourceProjectGroup;
}

const openSourceGroups: OpenSourceProjectGroup[] = ['frontend', 'backend', 'ecosystem'];

const openSourceProjects: OpenSourceProject[] = [
  { name: 'Tauri', url: 'https://github.com/tauri-apps/tauri', group: 'backend' },
  { name: 'React', url: 'https://github.com/facebook/react', group: 'frontend' },
  { name: 'Vite', url: 'https://github.com/vitejs/vite', group: 'frontend' },
  { name: 'TypeScript', url: 'https://github.com/microsoft/TypeScript', group: 'frontend' },
  { name: 'Tailwind CSS', url: 'https://github.com/tailwindlabs/tailwindcss', group: 'frontend' },
  { name: 'Framer Motion', url: 'https://github.com/framer/motion', group: 'frontend' },
  { name: 'Lucide', url: 'https://github.com/lucide-icons/lucide', group: 'frontend' },
  { name: 'i18next', url: 'https://github.com/i18next/i18next', group: 'frontend' },
  { name: 'react-i18next', url: 'https://github.com/i18next/react-i18next', group: 'frontend' },
  { name: 'Zustand', url: 'https://github.com/pmndrs/zustand', group: 'frontend' },
  { name: 'Norigin Spatial Navigation', url: 'https://github.com/NoriginMedia/Norigin-Spatial-Navigation', group: 'frontend' },
  { name: 'TanStack Virtual', url: 'https://github.com/tanstack/virtual', group: 'frontend' },
  { name: 'qrcode.react', url: 'https://github.com/zpao/qrcode.react', group: 'frontend' },
  { name: 'Three.js', url: 'https://github.com/mrdoob/three.js', group: 'frontend' },
  { name: 'skinview3d', url: 'https://github.com/bs-community/skinview3d', group: 'frontend' },
  { name: 'skinview3d-blockbench', url: 'https://github.com/bs-community/skinview3d-blockbench', group: 'frontend' },
  { name: 'Tokio', url: 'https://github.com/tokio-rs/tokio', group: 'backend' },
  { name: 'Serde', url: 'https://github.com/serde-rs/serde', group: 'backend' },
  { name: 'Reqwest', url: 'https://github.com/seanmonstar/reqwest', group: 'backend' },
  { name: 'SQLx', url: 'https://github.com/launchbadge/sqlx', group: 'backend' },
  { name: 'Axum', url: 'https://github.com/tokio-rs/axum', group: 'backend' },
  { name: 'tower-http', url: 'https://github.com/tower-rs/tower-http', group: 'backend' },
  { name: 'mdns-sd', url: 'https://github.com/keepsimple1/mdns-sd', group: 'backend' },
  { name: 'gilrs', url: 'https://gitlab.com/gilrs-project/gilrs', group: 'backend' },
  { name: 'sysinfo', url: 'https://github.com/GuillaumeGomez/sysinfo', group: 'backend' },
  { name: 'zip-rs', url: 'https://github.com/zip-rs/zip2', group: 'backend' },
  { name: 'QR-Code-generator', url: 'https://github.com/nayuki/QR-Code-generator', group: 'backend' },
  { name: 'Fabric Loader', url: 'https://github.com/FabricMC/fabric-loader', group: 'ecosystem' },
  { name: 'Quilt Loader', url: 'https://github.com/QuiltMC/quilt-loader', group: 'ecosystem' },
  { name: 'NeoForge', url: 'https://github.com/neoforged/NeoForge', group: 'ecosystem' },
  { name: 'MinecraftForge', url: 'https://github.com/MinecraftForge/MinecraftForge', group: 'ecosystem' },
  { name: 'Modrinth', url: 'https://github.com/modrinth/code', group: 'ecosystem' },
];

/* ─── 赞助者 tier 样式工具 ──────────────────────────── */

function getDonorTierBorder(amount: number): string {
  if (amount >= 100)
    return 'border-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.35)]';
  if (amount >= 50)
    return 'border-[#C77DFF]/70 shadow-[0_0_8px_rgba(199,125,255,0.25)]';
  if (amount >= 10)
    return 'border-[#64DFDF]/50 shadow-[0_0_6px_rgba(100,223,223,0.15)]';
  return 'border-white/15';
}

function getDonorAvatarSize(amount: number): string {
  if (amount >= 100) return 'w-14 h-14';
  if (amount >= 50) return 'w-11 h-11';
  return 'w-10 h-10';
}

/* ─── 浮动动画 CSS ──────────────────────────────────── */

const floatingKeyframes = `
@keyframes donor-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-7px); }
}
@keyframes donor-float-alt {
  0%, 100% { transform: translateY(-4px); }
  50% { transform: translateY(3px); }
}
@keyframes crown-bob {
  0%, 100% { transform: translateX(-50%) translateY(0px) rotate(-3deg); }
  50% { transform: translateX(-50%) translateY(-2px) rotate(3deg); }
}
@keyframes gold-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.3), inset 0 0 4px rgba(255,215,0,0.1); }
  50% { box-shadow: 0 0 16px rgba(255,215,0,0.5), inset 0 0 8px rgba(255,215,0,0.15); }
}
`;

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('0.0.0');
  const [donors, setDonors] = useState<any[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<DonorInfo | null>(null);
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [showOpenSourceModal, setShowOpenSourceModal] = useState(false);

  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(console.error);

    // Fetch donors via Tauri backend (bypasses CORS, hides API key)
    invoke('fetch_donors')
      .then((data: any) => {
        if (Array.isArray(data)) {
          // 按金额降序排列，让高额赞助者排在前面
          const sorted = [...data].sort(
            (a, b) => (b.amount || b.totalAmount || 0) - (a.amount || a.totalAmount || 0)
          );
          setDonors(sorted);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch donors:', err);
      });
  }, []);

  // ✅ 1. 补全焦点链：从上到下，覆盖所有区域，防止焦点出现断层
  const focusOrder = [
    'settings-about-product',
    'settings-about-open-source',
    'settings-about-github',
    'settings-about-bilibili',
    'settings-about-afdian',
    'settings-about-sponsors'
  ];

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  const links = [
    {
      id: 'github',
      title: t('settings.about.links.github.title'),
      desc: t('settings.about.links.github.desc'),
      url: 'https://github.com/MrShellad/pilauncher',
      icon: <Github size={20} className="text-white" />
    },
    {
      id: 'bilibili',
      title: t('settings.about.links.bilibili.title'),
      desc: t('settings.about.links.bilibili.desc'),
      url: 'https://space.bilibili.com/6221851',
      icon: <Tv size={20} className="text-[#00AEEC]" />
    },
    {
      id: 'afdian',
      title: t('settings.about.links.afdian.title'),
      desc: t('settings.about.links.afdian.desc'),
      url: 'https://ifdian.net/u/f60602b4004811eea0bf52540025c377',
      icon: <Zap size={20} className="text-[#946ce6]" />
    }
  ];

  const handleDonorClick = (donor: any) => {
    const amount = donor.amount || donor.totalAmount || 0;
    setSelectedDonor({
      mcUuid: donor.mcUuid,
      mcName: donor.mcName || t('settings.about.anonymous'),
      amount,
    });
    setShowSkinModal(true);
  };

  return (
    <FocusBoundary id="settings-about-boundary" className="w-full h-full outline-none">
      {/* 注入浮动动画 CSS */}
      <style>{floatingKeyframes}</style>

      <SettingsPageLayout adaptiveScale>

        {/* ==================== 产品基础信息 ==================== */}
        <SettingsSection title={t('settings.about.sections.product')} icon={<Info size={18} />}>
          {/* ✅ 2. 为纯展示区域添加 FocusItem 和 tabIndex={-1}，赋予阅读焦点 */}
          <FocusItem focusKey="settings-about-product" onArrowPress={handleLinearArrow}>
            {({ ref, focused }) => (
              <div
                ref={ref as any}
                tabIndex={-1}
                className={`flex flex-col items-center justify-center py-6 mx-4 mb-4 rounded-lg outline-none transition-all ${focused ? 'bg-[#141415] ring-2 ring-white shadow-lg z-10' : 'hover:bg-white/5'
                  }`}
              >
                <h1 className="text-4xl font-minecraft text-white mb-2 tracking-wider">PiLauncher</h1>
                <span className="text-ore-green font-mono text-sm bg-ore-green/10 px-3 py-1 rounded-full border border-ore-green/20 mb-4">
                  v{version}
                </span>
                <p className="text-ore-text-muted text-sm max-w-md text-center font-minecraft">
                  {t('settings.about.productDesc')}
                </p>
              </div>
            )}
          </FocusItem>

          <div className="flex justify-center px-4 pb-5">
            <OreButton
              focusKey="settings-about-open-source"
              onArrowPress={handleLinearArrow}
              variant="secondary"
              size="auto"
              className="min-w-[220px] justify-center whitespace-nowrap"
              onClick={() => setShowOpenSourceModal(true)}
            >
              <PackageOpen size={16} className="mr-2" />
              {t('settings.about.openSource.button')}
            </OreButton>
          </div>
        </SettingsSection>

        {/* ==================== 关注与支持 ==================== */}
        <SettingsSection title={t('settings.about.sections.support')} icon={<Heart size={18} />}>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {links.map((item) => (
              <FocusItem key={item.id} focusKey={`settings-about-${item.id}`} onArrowPress={handleLinearArrow}>
                {({ ref, focused }) => (
                  <a
                    ref={ref as any}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    /* ✅ 3. 移除 scale-[1.02]，替换为纯高亮设计 (ring-2 ring-white + 提亮背景) */
                    className={`flex flex-col items-center border rounded-lg p-5 transition-all outline-none
                      ${focused ? 'border-ore-green bg-[#1E1E1F] ring-2 ring-white shadow-[0_0_15px_rgba(56,133,39,0.2)] z-10' : 'bg-black/20 border-white/5 hover:bg-[#141415]'}
                    `}
                  >
                    <div className="flex items-center space-x-2 mb-3">
                      {item.icon}
                      <span className="text-white font-minecraft text-base">{item.title}</span>
                    </div>

                    <div className={`bg-white p-2 rounded-lg mb-3 relative group transition-transform ${focused ? 'scale-105' : ''}`}>
                      <QRCodeSVG value={item.url} size={110} />
                    </div>

                    <p className="text-xs text-ore-text-muted text-center flex-1">
                      {item.desc}
                    </p>
                    <div className={`mt-4 flex items-center text-[10px] px-2 py-1 rounded transition-colors ${focused ? 'text-ore-green bg-ore-green/10' : 'text-ore-text-muted/50 bg-black/20'}`}>
                      <ExternalLink size={10} className="mr-1" />
                      {t('settings.about.scanOrA')}
                    </div>
                  </a>
                )}
              </FocusItem>
            ))}
          </div>
        </SettingsSection>

        {/* ==================== 赞助者列表 (全新设计) ==================== */}
        <SettingsSection title={t('settings.about.sections.sponsors')} icon={<Users size={18} />}>
          {/* ✅ 4. 同样为底部展示区提供焦点垫脚石，方便用户手柄平滑滚动到底部 */}
          <FocusItem focusKey="settings-about-sponsors" onArrowPress={handleLinearArrow}>
            {({ ref, focused }) => (
              <div
                ref={ref as any}
                tabIndex={-1}
                className={`p-6 mx-4 mb-4 flex flex-col items-center justify-center text-center rounded-lg outline-none transition-all ${focused ? 'bg-[#141415] ring-2 ring-white shadow-lg z-10' : 'hover:bg-white/5'
                  }`}
              >
                <Heart size={32} className="text-[#946ce6]/50 mb-3" />
                <h3 className="text-white font-minecraft mb-2">{t('settings.about.thanks')}</h3>
                <p className="text-ore-text-muted text-sm max-w-xl leading-relaxed mb-6">
                  {t('settings.about.thanksDesc')}
                </p>

                {/* ──── 浮动头像展示区 ──── */}
                <div className="flex flex-wrap justify-center gap-5 mt-2">
                  {donors.length > 0 ? (
                    donors.map((donor, idx) => {
                      const amount = donor.amount || donor.totalAmount || 0;
                      const isGold = amount >= 100;
                      const tierColor = getDonorTierColor(amount);
                      const animName = idx % 2 === 0 ? 'donor-float' : 'donor-float-alt';
                      const delay = (idx * 0.4) % 3; // 错开动画相位

                      return (
                        <div
                          key={idx}
                          className="relative group cursor-pointer"
                          style={{
                            animation: `${animName} ${2.5 + (idx % 3) * 0.5}s ease-in-out ${delay}s infinite`,
                          }}
                          onClick={() => handleDonorClick(donor)}
                        >
                          {/* 金色赞助者头顶皇冠 */}
                          {isGold && (
                            <div
                              className="absolute -top-3.5 left-1/2 z-10 pointer-events-none"
                              style={{
                                animation: 'crown-bob 2s ease-in-out infinite',
                              }}
                            >
                              <Crown size={16} className="text-[#FFD700] drop-shadow-[0_0_4px_rgba(255,215,0,0.6)]" />
                            </div>
                          )}

                          {/* 头像容器 */}
                          <div
                            className={`
                              ${getDonorAvatarSize(amount)} rounded-lg border-2 overflow-hidden
                              transition-all duration-300 group-hover:scale-110
                              ${getDonorTierBorder(amount)}
                              ${isGold ? 'ring-1 ring-[#FFD700]/20' : ''}
                            `}
                            style={isGold ? { animation: 'gold-glow-pulse 2s ease-in-out infinite' } : undefined}
                          >
                            <img
                              src={`https://minotar.net/avatar/${donor.mcUuid}.png`}
                              alt={donor.mcName || 'Player'}
                              className="w-full h-full image-rendering-pixelated"
                              style={{ imageRendering: 'pixelated' }}
                              loading="lazy"
                            />
                          </div>

                          {/* Hover 浮动 ID 提示 */}
                          <div
                            className="
                              absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                              opacity-0 group-hover:opacity-100 transition-opacity duration-200
                              text-[10px] font-minecraft px-2 py-0.5 rounded-sm bg-black/95
                              border border-white/10 pointer-events-none z-20
                            "
                            style={{ color: tierColor }}
                          >
                            {donor.mcName || t('settings.about.anonymous')}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className={`text-xs px-3 py-1.5 rounded border transition-colors ${focused ? 'text-white bg-white/10 border-white/20' : 'text-white/70 bg-white/5 border-white/10'}`}>
                      {t('settings.about.emptySeat')}
                    </span>
                  )}
                </div>


              </div>
            )}
          </FocusItem>
        </SettingsSection>

      </SettingsPageLayout>

      {/* 3D 皮肤查看器弹窗 */}
      <DonorSkinModal
        isOpen={showSkinModal}
        onClose={() => {
          setShowSkinModal(false);
          setSelectedDonor(null);
        }}
        donor={selectedDonor}
      />

      <OreModal
        isOpen={showOpenSourceModal}
        onClose={() => setShowOpenSourceModal(false)}
        title={t('settings.about.openSource.title')}
        defaultFocusKey="settings-about-open-source-project-0"
        className="w-full max-w-[860px]"
        contentClassName="p-0 overflow-hidden"
        actions={
          <div className="flex w-full justify-center gap-3">
            <OreButton
              focusKey="settings-about-open-source-close"
              onClick={() => setShowOpenSourceModal(false)}
              size="full"
              className="flex-1"
            >
              {t('common.finish')}
            </OreButton>
          </div>
        }
      >
        <div className="flex h-[520px] flex-col">
          <div className="border-b-[3px] border-[var(--ore-border-color)] bg-black/20 px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <PackageOpen size={20} className="text-ore-green" />
              <span className="font-minecraft text-base">{t('settings.about.openSource.headline')}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ore-text-muted">
              {t('settings.about.openSource.description', { count: openSourceProjects.length })}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
            {openSourceGroups.map((group) => {
              const groupProjects = openSourceProjects.filter((project) => project.group === group);

              return (
                <section key={group} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-sm text-white">
                      {t(`settings.about.openSource.groups.${group}`)}
                    </h3>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">
                      {groupProjects.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {groupProjects.map((project) => {
                      const globalIndex = openSourceProjects.indexOf(project);

                      return (
                        <div
                          key={project.name}
                          className="flex min-w-0 items-center gap-3 rounded-sm border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-white" title={project.name}>{project.name}</div>
                            <div className="mt-1 truncate font-mono text-[10px] text-ore-text-muted" title={project.url}>
                              {project.url}
                            </div>
                          </div>

                          <OreButton
                            focusKey={`settings-about-open-source-project-${globalIndex}`}
                            variant="ghost"
                            className="!h-8 !min-w-[70px] !px-3 !text-xs"
                            onClick={() => void openExternalLink(project.url)}
                          >
                            <ExternalLink size={12} className="mr-1.5" />
                            {t('settings.about.openSource.open')}
                          </OreButton>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </OreModal>
    </FocusBoundary>
  );
};
