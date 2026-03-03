// /src/pages/NewInstance.tsx
import React, { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Hammer, PackagePlus, FolderArchive, ArrowLeft, Zap, Server as ServerIcon } from 'lucide-react';
import { CustomInstanceView } from '../features/Instances/components/CustomInstanceView';
import { ModpackView } from '../features/Instances/components/ModpackView';
import { LocalImportView } from '../features/Instances/components/LocalImportView';
// 引入 Tauri 的系统浏览器调用 API
import { open } from '@tauri-apps/plugin-shell';

// 引入动画令牌和焦点引擎
import { OreMotionTokens } from '../style/tokens/motion';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';

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

export default function NewInstance() {
  const [view, setView] = useState<CreationView>('menu');
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
    if (view === 'menu') {
      const timer = setTimeout(() => focusManager.focus('card-custom'), 100);
      return () => clearTimeout(timer);
    }
  }, [view]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'menu') {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        setView('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [view]);

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
    <FocusBoundary id="new-instance-page" className="flex flex-col w-full h-full overflow-hidden">
      
      {/* 视图 1：大卡片主菜单 */}
      {view === 'menu' && (
        <div className="flex flex-col w-full h-full px-8 pb-8 pt-4 md:px-12 md:pb-12 md:pt-6 relative">
          
          <div className="mb-6 text-center">
            <h1 className="text-white font-minecraft text-3xl tracking-widest drop-shadow-md">新建实例环境</h1>
            <p className="text-[#A0A0A0] font-minecraft mt-1.5 text-sm">选择一种方式来开启你的新冒险</p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 xl:gap-12 flex-1">
            <FocusItem focusKey="card-custom" onEnter={() => setView('custom')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => setView('custom')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`w-52 h-64 md:w-60 md:h-72 bg-[#2A2A2C] border-[3px] border-[#1E1E1F] flex flex-col cursor-pointer shadow-xl ${focused ? 'outline outline-[4px] outline-offset-4 outline-ore-green z-20' : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <Hammer size={120} className="absolute text-white/5 right-[-20px] bottom-[-20px]" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <Hammer size={72} className="text-ore-green drop-shadow-[0_0_15px_rgba(56,133,39,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="h-16 flex items-center justify-center bg-[#3A3B3D] border-t-[3px] border-[#1E1E1F]">
                    <span className="text-white font-minecraft text-xl tracking-wider font-bold">完全自建</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>

            <FocusItem focusKey="card-download" onEnter={() => setView('download')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => setView('download')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`w-52 h-64 md:w-60 md:h-72 bg-[#2A2A2C] border-[3px] border-[#1E1E1F] flex flex-col cursor-pointer shadow-xl ${focused ? 'outline outline-[4px] outline-offset-4 outline-blue-500 z-20' : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <PackagePlus size={120} className="absolute text-white/5 right-[-20px] bottom-[-20px]" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <PackagePlus size={72} className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="h-16 flex items-center justify-center bg-[#3A3B3D] border-t-[3px] border-[#1E1E1F]">
                    <span className="text-white font-minecraft text-xl tracking-wider font-bold">下载整合包</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>

            <FocusItem focusKey="card-import" onEnter={() => setView('import')}>
              {({ ref, focused }) => (
                <motion.div
                  ref={ref} onClick={() => setView('import')}
                  initial="rest" animate={focused ? "hover" : "rest"} whileHover="hover"
                  variants={OreMotionTokens.bedrockCardHover as Variants}
                  className={`w-52 h-64 md:w-60 md:h-72 bg-[#2A2A2C] border-[3px] border-[#1E1E1F] flex flex-col cursor-pointer shadow-xl ${focused ? 'outline outline-[4px] outline-offset-4 outline-orange-400 z-20' : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center bg-[#1E1E1F]/50 relative overflow-hidden">
                    <FolderArchive size={120} className="absolute text-white/5 right-[-20px] bottom-[-20px]" />
                    <motion.div variants={OreMotionTokens.bedrockIconHover as Variants}>
                      <FolderArchive size={72} className="text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]" />
                    </motion.div>
                  </div>
                  <div className="h-16 flex items-center justify-center bg-[#3A3B3D] border-t-[3px] border-[#1E1E1F]">
                    <span className="text-white font-minecraft text-xl tracking-wider font-bold">本地导入</span>
                  </div>
                </motion.div>
              )}
            </FocusItem>
          </div>

          {/* ================= 底部动态推荐区 ================= */}
          {sponsors.length > 0 && (
            <div className="mt-auto pt-6 border-t-2 border-[#1E1E1F]">
              <div className="flex items-center mb-1">
                <Zap size={20} className="text-yellow-400 mr-2 drop-shadow-md" fill="currentColor" />
                <h2 className="text-yellow-400 font-minecraft text-lg tracking-wider font-bold drop-shadow-md">
                  Power 赞助
                </h2>
              </div>
              
              <div className="flex overflow-x-auto gap-4 pt-3 pb-4 px-2 -mx-2 custom-scrollbar">
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
                        className={`flex flex-row items-center w-72 h-20 rounded-sm border-2 flex-shrink-0 cursor-pointer transition-all backdrop-blur-sm 
                          /* 统一使用 brightness 滤镜来实现 hover/active 交互，这样不会被内联样式覆盖！ */
                          hover:brightness-95 active:scale-[0.98] 
                          ${focused ? 'outline outline-[3px] outline-offset-[4px] outline-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.2)] z-10 brightness-95' : ''}
                          ${!sponsor.backgroundColor ? 'bg-white/5' : ''}
                          ${!sponsor.borderColor ? 'border-white/10' : ''}
                        `}
                        title="点击获取专属赞助优惠"
                      >
                        {/* ✅ 图标区：动态适配右侧描边 */}
                        <div 
                          className={`w-20 h-full flex items-center justify-center overflow-hidden border-r-2 p-2 ${!sponsor.borderColor ? 'border-white/10' : ''}`}
                          style={{ borderColor: sponsor.borderColor }}
                        >
                          {sponsor.icon && sponsor.icon !== "" ? (
                            <img src={sponsor.icon} alt="sponsor icon" className="w-full h-full object-contain drop-shadow-md" />
                          ) : (
                            <ServerIcon size={32} className={`${sponsor.textColor ? 'opacity-50' : 'text-white/40'} drop-shadow-md`} />
                          )}
                        </div>
                        
                        <div className="flex flex-col justify-center px-3 flex-1 overflow-hidden">
                          {/* ✅ 标题与描述：优先使用 textColor，否则使用默认浅色体系 */}
                          <span className={`font-minecraft text-sm truncate font-bold ${!sponsor.textColor ? 'text-white' : ''}`}>
                            {sponsor.name}
                          </span>
                          <span className={`text-[10px] truncate mt-0.5 ${!sponsor.textColor ? 'text-[#A0A0A0]' : 'opacity-80'}`}>
                            {sponsor.desc}
                          </span>
                          
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex gap-1">
                              {sponsor.tags.map(tag => (
                                // ✅ 标签框：自适应 textColor 的描边和颜色
                                <span key={tag} className={`text-[9px] px-1 rounded border ${!sponsor.textColor ? 'bg-white/10 text-gray-300 border-white/5' : 'border-current opacity-80'}`}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                            {/* 价格强制使用醒目的颜色 (或者根据背景色自动调整) */}
                            <div className={`flex items-center text-[10px] font-minecraft font-bold drop-shadow-md ${sponsor.textColor ? '' : 'text-yellow-400'}`}>
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
          <div className="h-14 bg-[#1E1E1F] border-b-2 border-[#141415] flex items-center px-4 flex-shrink-0 z-20">
            <FocusItem focusKey="btn-back-menu" onEnter={() => setView('menu')}>
              {({ ref, focused }) => (
                <button 
                  ref={ref} 
                  onClick={() => setView('menu')} 
                  className={`flex items-center transition-colors font-minecraft px-4 py-2 rounded-sm outline-none ${focused ? 'text-white bg-white/10 ring-2 ring-white shadow-lg' : 'text-ore-text-muted hover:text-white hover:bg-white/5'}`}
                >
                  <ArrowLeft size={18} className="mr-2" />返回创建菜单
                </button>
              )}
            </FocusItem>
            
            <div className="ml-auto flex items-center pr-4">
              <span className="text-white font-minecraft text-lg font-bold">
                {view === 'custom' && '自建实例'}
                {view === 'download' && '下载整合包'}
                {view === 'import' && '导入本地整合包'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {view === 'custom' && <CustomInstanceView />}
            {view === 'download' && <ModpackView />}
            {view === 'import' && <LocalImportView />}
          </div>
        </div>
      )}

    </FocusBoundary>
  );
}