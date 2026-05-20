// /src/pages/NewInstance.tsx
import { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Hammer, PackagePlus, FolderArchive, ArrowLeft, Zap, Server as ServerIcon } from 'lucide-react';
import { CustomInstanceView } from '../features/Instances/components/CustomInstanceView';
import { ModpackView } from '../features/Instances/components/ModpackView';
import { LocalImportView } from '../features/Instances/components/LocalImportView';
import { useLauncherStore } from '../store/useLauncherStore';
// 引入 Tauri 的系统浏览器调用 API
import { open } from '@tauri-apps/plugin-shell';

// 引入动画令牌和焦点引擎
import { OreMotionTokens } from '../style/tokens/motion';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';

// 引入本地 JSON
import localSponsorData from '../assets/config/sponsor.json';

type CreationView = 'menu' | 'custom' | 'download' | 'import';

// ✅ 完美适配你的新 JSON 结构
interface SponsorItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  tags: string[];
  price: string;
  link: string;
  regions: string[];
  priority: number;
  enabled: boolean;
  borderColor?: string;      // 新增：描边色
  backgroundColor?: string;  // 新增：背景色
  textColor?: string;        // 新增：文字颜色
}

const SAFE_AREA_STYLE = {
  paddingTop: 'env(safe-area-inset-top)',
  paddingRight: 'env(safe-area-inset-right)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  paddingLeft: 'env(safe-area-inset-left)'
};

const MAIN_CARD_BASE_CLASS =
  'w-[12.5rem] aspect-[5/6] md:w-[15rem] 2xl:w-[16rem] bg-[#2A2A2C] border-[0.1875rem] border-[#1E1E1F] flex flex-col cursor-pointer shadow-xl select-none shrink-0';

const MAIN_CARD_FOCUS_CLASS =
  'outline outline-[0.25rem] outline-offset-[0.25rem] z-20';

// 🎮 手柄按键 SVG 图标组件
const GamepadBtn = ({ text, color, shadow, fontSize = "13" }: { text: string, color: string, shadow: string, fontSize?: string }) => (
  <svg width="1.375rem" height="1.375rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block flex-shrink-0">
    <circle cx="12" cy="12" r="10" fill={color} className={shadow} />
    <text x="12" y="16.5" fontSize={fontSize} fontWeight="900" fontFamily="system-ui, sans-serif" fill="#1E1E1F" textAnchor="middle">
      {text}
    </text>
  </svg>
);

export default function NewInstance() {
  const [view, setView] = useState<CreationView>(() => {
    // 如果从新闻卡片跳转过来，直接进入自建流程
    const pending = useLauncherStore.getState().pendingNewsVersion;
    return pending ? 'custom' : 'menu';
  });

  // ✅ 包装 setView：返回 menu 时清理 pendingNewsVersion，防止下次进入时误触
  const handleSetView = (newView: CreationView) => {
    if (newView === 'menu') {
      useLauncherStore.getState().setPendingNewsVersion(null);
    }
    setView(newView);
  };
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);

  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const data = localSponsorData; 
        const userLang = navigator.language.toLowerCase();
        const currentRegion = userLang.startsWith('zh') ? 'cn' : 'global';

        const activeSponsors = data.items
          .filter((item: SponsorItem) => item.enabled && item.regions.includes(currentRegion))
          .sort((a: SponsorItem, b: SponsorItem) => a.priority - b.priority);

        setSponsors(activeSponsors);
      } catch (error) {
        console.error("赞助数据加载失败:", error);
      }
    };
    fetchSponsors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === 'menu') {
        focusManager.focus('card-custom');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'menu') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        handleSetView('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [view]);

  // ✅ 监听手柄 B 键 (CANCEL) 返回主菜单
  useInputAction('CANCEL', () => {
    if (view !== 'menu') {
      handleSetView('menu');
    }
  });

  // 调用系统原生浏览器打开推广链接
  const handleOpenLink = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.warn('Tauri shell 打开失败，回退到浏览器默认方法', err);
      window.open(url, '_blank');
    }
  };

  return (
    <FocusBoundary id="new-instance-page" className="flex h-full min-h-0 w-full flex-col overflow-hidden" style={SAFE_AREA_STYLE}>
      
      {/* 视图 1：大卡片主菜单 */}
      {view === 'menu' && (
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-y-auto px-[1.5rem] pb-[1.5rem] pt-[1rem] sm:px-[2rem] md:px-[3rem] md:pb-[3rem] md:pt-[1.5rem] custom-scrollbar">
          
          <div className="mb-[1.5rem] text-center">
            <h1 className="font-minecraft text-[1.875rem] leading-[2.25rem] tracking-widest text-white drop-shadow-md">新建实例环境</h1>
            <p className="mt-[0.375rem] font-minecraft text-[0.875rem] leading-[1.25rem] text-[#A0A0A0]">选择一种方式来开启你的新冒险</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-[2rem] px-[0.5rem] py-[0.75rem] xl:gap-[3rem]">
            <FocusItem focusKey="card-custom" onEnter={() => handleSetView('custom')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => handleSetView('custom')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`${MAIN_CARD_BASE_CLASS} ${focused ? `${MAIN_CARD_FOCUS_CLASS} outline-ore-green` : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <Hammer size="7.5rem" className="absolute bottom-[-1.25rem] right-[-1.25rem] text-white/5" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <Hammer size="4.5rem" className="text-ore-green drop-shadow-[0_0_0.9375rem_rgba(56,133,39,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="flex h-[4rem] items-center justify-center border-t-[0.1875rem] border-[#1E1E1F] bg-[#3A3B3D] md:h-[4.5rem]">
                    <span className="font-minecraft text-[1.25rem] font-bold leading-[1.5rem] tracking-wider text-white">完全自建</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>

            <FocusItem focusKey="card-download" onEnter={() => handleSetView('download')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => handleSetView('download')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`${MAIN_CARD_BASE_CLASS} ${focused ? `${MAIN_CARD_FOCUS_CLASS} outline-blue-500` : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <PackagePlus size="7.5rem" className="absolute bottom-[-1.25rem] right-[-1.25rem] text-white/5" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <PackagePlus size="4.5rem" className="text-blue-400 drop-shadow-[0_0_0.9375rem_rgba(59,130,246,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="flex h-[4rem] items-center justify-center border-t-[0.1875rem] border-[#1E1E1F] bg-[#3A3B3D] md:h-[4.5rem]">
                    <span className="font-minecraft text-[1.25rem] font-bold leading-[1.5rem] tracking-wider text-white">下载整合包</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>

            <FocusItem focusKey="card-import" onEnter={() => handleSetView('import')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => handleSetView('import')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`${MAIN_CARD_BASE_CLASS} ${focused ? `${MAIN_CARD_FOCUS_CLASS} outline-orange-400` : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <FolderArchive size="7.5rem" className="absolute bottom-[-1.25rem] right-[-1.25rem] text-white/5" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <FolderArchive size="4.5rem" className="text-orange-400 drop-shadow-[0_0_0.9375rem_rgba(251,146,60,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="flex h-[4rem] items-center justify-center border-t-[0.1875rem] border-[#1E1E1F] bg-[#3A3B3D] md:h-[4.5rem]">
                    <span className="font-minecraft text-[1.25rem] font-bold leading-[1.5rem] tracking-wider text-white">本地导入</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>
          </div>

          {/* ================= 底部动态推荐区 ================= */}
          {sponsors.length > 0 && (
            <div className="mt-auto border-t-[0.125rem] border-[#1E1E1F] pt-[1.5rem]">
              <div className="mb-[0.25rem] flex items-center">
                <Zap size="1.25rem" className="mr-[0.5rem] text-yellow-400 drop-shadow-md" fill="currentColor" />
                <h2 className="font-minecraft text-[1.125rem] font-bold leading-[1.75rem] tracking-wider text-yellow-400 drop-shadow-md">
                  Power 赞助
                </h2>
              </div>
              
              <div className="-mx-[0.5rem] flex gap-[1rem] overflow-x-auto px-[0.5rem] pb-[1rem] pt-[0.75rem] custom-scrollbar">
                {sponsors.map((sponsor) => (
                  <FocusItem key={sponsor.id} focusKey={`sponsor-${sponsor.id}`} onEnter={() => handleOpenLink(sponsor.link)}>
                    {({ ref, focused }) => (
                      <div 
                        ref={ref} 
                        onClick={() => handleOpenLink(sponsor.link)}
                        // ✅ 动态注入背景色、描边色和文字色
                        style={{
                          backgroundColor: sponsor.backgroundColor || '',
                          borderColor: sponsor.borderColor || '',
                          color: sponsor.textColor || ''
                        }}
                        className={`flex h-[5rem] w-[18rem] flex-shrink-0 cursor-pointer flex-row items-center rounded-[0.125rem] border-[0.125rem] transition-all 2xl:h-[5.5rem] 2xl:w-[20rem]
                          /* 统一使用 brightness 滤镜来实现 hover/active 交互，这样不会被内联样式覆盖！ */
                          hover:brightness-95 active:scale-[0.98] 
                          ${focused ? 'outline outline-[0.1875rem] outline-offset-[0.25rem] outline-yellow-400/50 shadow-[0_0_0.9375rem_rgba(250,204,21,0.2)] z-10 brightness-95' : ''}
                          ${!sponsor.backgroundColor ? 'bg-black/45' : ''}
                          ${!sponsor.borderColor ? 'border-white/10' : ''}
                        `}
                        title="点击获取专属赞助优惠"
                      >
                        {/* ✅ 图标区：动态适配右侧描边 */}
                        <div 
                          className={`flex h-full w-[5rem] items-center justify-center overflow-hidden border-r-[0.125rem] p-[0.5rem] 2xl:w-[5.5rem] ${!sponsor.borderColor ? 'border-white/10' : ''}`}
                          style={{ borderColor: sponsor.borderColor }}
                        >
                          {sponsor.icon && sponsor.icon !== "" ? (
                            <img src={sponsor.icon} alt="sponsor icon" className="w-full h-full object-contain drop-shadow-md" />
                          ) : (
                            <ServerIcon size="2rem" className={`${sponsor.textColor ? 'opacity-50' : 'text-white/40'} drop-shadow-md`} />
                          )}
                        </div>
                        
                        <div className="flex flex-1 flex-col justify-center overflow-hidden px-[0.75rem]">
                          {/* ✅ 标题与描述：优先使用 textColor，否则使用默认浅色体系 */}
                          <span className={`truncate font-minecraft text-[0.875rem] font-bold leading-[1.25rem] ${!sponsor.textColor ? 'text-white' : ''}`}>
                            {sponsor.name}
                          </span>
                          <span className={`mt-[0.125rem] truncate text-[0.625rem] leading-[0.875rem] ${!sponsor.textColor ? 'text-[#A0A0A0]' : 'opacity-80'}`}>
                            {sponsor.desc}
                          </span>
                          
                          <div className="mt-[0.375rem] flex items-center justify-between">
                            <div className="flex gap-[0.25rem]">
                              {sponsor.tags.map(tag => (
                                // ✅ 标签框：自适应 textColor 的描边和颜色
                                <span key={tag} className={`rounded-[0.125rem] border px-[0.25rem] text-[0.5625rem] leading-[0.75rem] ${!sponsor.textColor ? 'bg-white/10 text-gray-300 border-white/5' : 'border-current opacity-80'}`}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                            {/* 价格强制使用醒目的颜色 (或者根据背景色自动调整) */}
                            <div className={`flex items-center font-minecraft text-[0.625rem] font-bold leading-[0.875rem] drop-shadow-md ${sponsor.textColor ? '' : 'text-yellow-400'}`}>
                              {sponsor.price}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 视图 2：子功能容器（保持不变） */}
      {view !== 'menu' && (
        <div className="flex flex-col w-full h-full">
          <div className="z-20 flex h-[3.5rem] flex-shrink-0 items-center border-b-[0.125rem] border-[#141415] bg-[#1E1E1F] px-[1rem]">
            <button 
              onClick={() => handleSetView('menu')} 
              tabIndex={-1}
              className={`
                flex items-center rounded-[0.125rem] px-[1rem] py-[0.5rem] font-minecraft text-ore-text-muted outline-none transition-colors hover:bg-white/5 hover:text-white
              `}
            >
              <ArrowLeft size="1.125rem" className="mr-[0.5rem]" />
              返回创建菜单
              <div className="ml-[0.75rem] flex items-center text-[0.625rem] text-ore-text-muted/60">
                <GamepadBtn text="B" color="#EF4444" shadow="drop-shadow-[0_0_0.125rem_rgba(239,68,68,0.5)]" fontSize="11" />
              </div>
            </button>
            
            <div className="ml-auto flex items-center pr-[1rem]">
              <span className="font-minecraft text-[1.125rem] font-bold leading-[1.75rem] text-white">
                {view === 'custom' && '自建实例'}
                {view === 'download' && '下载整合包'}
                {view === 'import' && '导入本地整合包'}
              </span>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden pt-[0.25rem]">
            {view === 'custom' && <CustomInstanceView onSuccess={() => handleSetView('menu')} />}
            {view === 'download' && <ModpackView />}
            {view === 'import' && <LocalImportView />}
          </div>
        </div>
      )}

    </FocusBoundary>
  );
}
