import React, { useEffect, useState } from 'react';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { Info, Github, Heart, Users, ExternalLink, Tv, Zap } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { QRCodeSVG } from 'qrcode.react';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

export const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState<string>('0.0.0');

  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(console.error);
  }, []);

  // ✅ 1. 补全焦点链：从上到下，覆盖所有区域，防止焦点出现断层
  const focusOrder = [
    'settings-about-product',
    'settings-about-github',
    'settings-about-bilibili',
    'settings-about-afdian',
    'settings-about-sponsors'
  ];

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  const links = [
    {
      id: 'github',
      title: '项目 GitHub',
      desc: '开源地址，欢迎提交 PR 与 Issue',
      url: 'https://github.com/MrShellad/pilauncher',
      icon: <Github size={20} className="text-white" />
    },
    {
      id: 'bilibili',
      title: '作者 Bilibili',
      desc: '关注作者，获取最新开发动态',
      url: 'https://space.bilibili.com/6221851',
      icon: <Tv size={20} className="text-[#00AEEC]" />
    },
    {
      id: 'afdian',
      title: '爱发电',
      desc: '赞助开发，支持本项目持续维护',
      url: 'https://ifdian.net/u/f60602b4004811eea0bf52540025c377',
      icon: <Zap size={20} className="text-[#946ce6]" />
    }
  ];

  return (
    <FocusBoundary id="settings-about-boundary" className="w-full h-full outline-none">
      <SettingsPageLayout>

        {/* ==================== 产品基础信息 ==================== */}
        <SettingsSection title="产品信息" icon={<Info size={18} />}>
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
                  专为掌机与手柄优化的跨平台 Minecraft 启动器。
                </p>
              </div>
            )}
          </FocusItem>
        </SettingsSection>

        {/* ==================== 关注与支持 ==================== */}
        <SettingsSection title="关注与支持" icon={<Heart size={18} />}>
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
                      扫码或按A键访问
                    </div>
                  </a>
                )}
              </FocusItem>
            ))}
          </div>
        </SettingsSection>

        {/* ==================== 赞助者列表 ==================== */}
        <SettingsSection title="赞助者" icon={<Users size={18} />}>
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
                <h3 className="text-white font-minecraft mb-2">感谢所有支持我们的赞助者</h3>
                <p className="text-ore-text-muted text-sm max-w-xl leading-relaxed mb-4">
                  正是因为有了你们的支持，PiLauncher 才能不断改进与完善。
                  如果你也想支持我们，可以通过上方的爱发电进行赞助。
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <span className={`text-xs px-3 py-1.5 rounded border transition-colors ${focused ? 'text-white bg-white/10 border-white/20' : 'text-white/70 bg-white/5 border-white/10'}`}>
                    虚位以待...
                  </span>
                </div>
              </div>
            )}
          </FocusItem>
        </SettingsSection>

      </SettingsPageLayout>
    </FocusBoundary>
  );
};