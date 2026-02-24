import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreAccordion } from '../../../../ui/primitives/OreAccordion';
import { OreMotionTokens } from '../../../../style/tokens/motion';
// ✅ 引入对应的引导器图标
import { ArrowRight, ChevronLeft, Leaf, Feather, Anvil, Hexagon } from 'lucide-react'; 
import { useCustomInstance } from '../../../../hooks/pages/Instances/useCustomInstance';

type StepProps = ReturnType<typeof useCustomInstance>;

export const LoaderSelectStep: React.FC<StepProps> = ({
  gameVersion, loaderType, setLoaderType, loaderVersion, setLoaderVersion,
  loaderVersions, isLoadingLoaders, handleNextStep, handlePrevStep
}) => {
  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pt-4 min-h-0">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-minecraft text-white ore-text-shadow">选择引导器</h2>
          <p className="text-ore-text-muted font-minecraft text-sm mt-1 tracking-widest">Step 2: 赋予游戏 Mod 运行能力</p>
        </div>
        <div className="flex space-x-4">
          <OreButton variant="secondary" size="auto" onClick={handlePrevStep}>
            <ChevronLeft size={18} className="mr-1" />上一步
          </OreButton>
          <OreButton variant="primary" size="auto" onClick={handleNextStep}>
            下一步 <ArrowRight size={18} className="ml-2" />
          </OreButton>
        </div>
      </div>

      {/* 引导器类型切换 */}
      <div className="flex w-full mb-6">
        <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 relative overflow-hidden">
          {(['Vanilla', 'Fabric', 'Forge', 'NeoForge'] as const).map(t => (
            <button 
              key={t} 
              onClick={() => setLoaderType(t)} 
              className={`relative px-4 py-2 font-minecraft text-sm z-10 transition-colors whitespace-nowrap ${loaderType === t ? 'text-white' : 'text-ore-text-muted hover:text-white'}`}
            >
              {loaderType === t && (
                <motion.div 
                  layoutId="lTab" 
                  className="absolute inset-0 bg-white/20 shadow-inner" 
                  transition={OreMotionTokens.segmentActiveLayout as any} 
                />
              )}
              {/* ✅ 在这里加入对应的图标映射 */}
              <span className="relative flex items-center">
                {t === 'Vanilla' && <Leaf size={14} className="mr-1.5" />}
                {t === 'Fabric' && <Feather size={14} className="mr-1.5" />}
                {t === 'Forge' && <Anvil size={14} className="mr-1.5" />}
                {t === 'NeoForge' && <Hexagon size={14} className="mr-1.5" />}
                {t}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 引导器版本列表，带平滑加载动画 */}
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
        <AnimatePresence mode="wait">
          {isLoadingLoaders ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-32 flex items-center justify-center text-ore-text-muted font-minecraft"
            >
              <span className="animate-pulse">正在查找兼容版本...</span>
            </motion.div>
          ) : loaderType === 'Vanilla' ? (
            <motion.div
              key="vanilla"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-ore-gray-border"
            >
              <Leaf size={48} className="text-ore-green opacity-50 mb-3" />
              <span className="font-minecraft text-white text-xl tracking-widest">纯净原版已就绪</span>
            </motion.div>
          ) : (
            <motion.div
              key={`loader-list-${loaderType}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="pb-12"
            >
              <OreAccordion title={`${loaderType} 可用版本`} defaultExpanded>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-2">
                  {loaderVersions.map(v => (
                    <motion.div 
                      key={v} 
                      whileHover={OreMotionTokens.buttonHover} 
                      whileTap={OreMotionTokens.buttonTap} 
                      onClick={() => setLoaderVersion(v)} 
                      className={`p-3 border-2 cursor-pointer transition-all flex flex-col justify-center ${loaderVersion === v ? 'bg-ore-green/20 border-ore-green' : 'bg-[#1E1E1F] border-ore-gray-border hover:border-white/50'}`}
                    >
                      <span className="font-minecraft text-white font-bold">{v}</span>
                      <p className="text-[10px] text-ore-text-muted mt-1">适用: {gameVersion}</p>
                    </motion.div>
                  ))}
                </div>
              </OreAccordion>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};