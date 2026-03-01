// /src/features/Download/components/FilterBar.tsx
import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import { FocusItem } from '../../../ui/focus/FocusItem';

// 1. SVG 图标
export const ModrinthIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73a11 10.999 0 0 0-2.17 3.11a11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77c.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02c.2-.04.22.1-.26-1.7l-.36-1.37l-1.01-.06a8.5 8.489 0 0 1-5.18-1.8a5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97l2.07-.43l2.06-.43l1.47-1.47c.8-.8 1.48-1.5 1.48-1.52c0-.09-.42-1.63-.46-1.7c-.04-.06-.2-.03-1.02.18c-.53.13-1.2.3-1.45.4l-.48.15l-.53.53l-.53.53l-.93.1l-.93.07l-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6l.43-.57c.68-.9.68-.9 1.46-1.1c.4-.1.65-.2.83-.33c.13-.099.65-.579 1.14-1.069l.9-.9l-.7-.7l-.7-.7l-1.95.54c-1.07.3-1.96.53-1.97.53c-.03 0-2.23 2.48-2.63 2.97l-.29.35l.28 1.03c.16.56.3 1.16.31 1.34l.03.3l-.34.23c-.37.23-2.22 1.3-2.84 1.63c-.36.2-.37.2-.44.1c-.08-.1-.23-.6-.32-1.03c-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1c.06-.17.5-2.999.47-3.039c-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38c-.06.23-.46 2.42-.46 2.52c0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2a8.38 8.379 0 0 1 2.16 3.449a6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38c-.38.32-1.54 1.1-1.7 1.14c-.1.03-.1.06-.07.26c.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"></path>
  </svg>
);

export const CurseforgeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...props}>
    <path fill="currentColor" d="M18.326 9.214s4.9-.772 5.674-3.026h-7.507V4.4H0l2.032 2.358v2.415s5.127-.267 7.11 1.237c2.714 2.516-3.053 5.917-3.053 5.917l-.99 3.273c1.547-1.473 4.494-3.377 9.899-3.286c-2.057.65-4.125 1.665-5.735 3.286h10.925l-1.029-3.273s-7.918-4.668-.833-7.112z"></path>
  </svg>
);

// 2. 读取 MC 版本配置
import mcvData from '../../../assets/download/mcv.json';
const MC_VERSIONS: string[] = Array.isArray(mcvData) ? mcvData : (mcvData as any)?.versions || [];

interface FilterBarProps {
  query: string; setQuery: (v: string) => void;
  source: string; setSource: (v: string) => void;
  mcVersion: string; setMcVersion: (v: string) => void;
  loaderType: string; setLoaderType: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  sort: string; setSort: (v: any) => void;
  onSearch: () => void;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = (props) => {
  const sourceOptions = [
    { 
      label: <div className="flex items-center"><ModrinthIcon className={`mr-1.5 text-lg ${props.source === 'modrinth' ? 'text-white' : 'text-ore-green'}`} /> Modrinth</div>, 
      value: 'modrinth' 
    },
    { 
      label: <div className="flex items-center"><CurseforgeIcon className={`mr-1.5 text-lg ${props.source === 'curseforge' ? 'text-white' : 'text-[#F16436]'}`} /> CurseForge</div>, 
      value: 'curseforge' 
    }
  ];

  return (
    <div className="p-4 bg-black/40 backdrop-blur-xl border-b border-white/10 shadow-lg z-10 flex-shrink-0">
      
      {/* 采用双行对齐布局 */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* ================= 左侧列：来源切换 (上) + 搜索框 (下) ================= */}
        <div className="flex flex-col gap-3 w-full lg:w-[280px] flex-shrink-0">
          
          {/* 1. 上层：来源切换 (✅ 添加焦点包裹，将高度增加到 h-10) */}
          <FocusItem onEnter={() => props.setSource(props.source === 'modrinth' ? 'curseforge' : 'modrinth')}>
            {({ ref, focused }) => (
              <div ref={ref as any} className={`w-full transition-all rounded-sm ${focused ? 'ring-2 ring-white scale-[1.01] z-10 shadow-lg brightness-125' : ''}`}>
                <OreToggleButton 
                  options={sourceOptions}
                  value={props.source}
                  onChange={props.setSource}
                  className="!m-0 h-10 [&>.ore-toggle-btn-group]:!h-full" 
                />
              </div>
            )}
          </FocusItem>

          {/* 2. 下层：搜索框 (✅ 添加焦点包裹，将输入框的 ref 暴露给空间导航) */}
          <FocusItem>
            {({ ref, focused }) => (
              <div className={`relative w-full transition-all rounded-sm ${focused ? 'ring-2 ring-white scale-[1.01] z-10 shadow-lg' : ''}`}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  ref={ref as any}
                  type="text" placeholder="搜索名称..."
                  value={props.query} onChange={(e) => props.setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && props.onSearch()}
                  className="w-full bg-black/30 border border-white/10 focus:bg-black/50 text-white py-2 pl-9 pr-4 rounded-sm outline-none font-minecraft transition-all text-sm h-10"
                />
              </div>
            )}
          </FocusItem>

        </div>

        {/* ================= 右侧列：筛选下拉矩阵 (上) + 操作按钮 (下) ================= */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
          
          {/* 3. 上层：四个下拉框 (✅ 全部独立包裹焦点导航) */}
          <div className="flex items-center gap-2 min-w-max">
            <FocusItem>
              {({ ref, focused }) => (
                <select 
                  ref={ref as any} value={props.mcVersion} onChange={(e) => props.setMcVersion(e.target.value)}
                  className={`bg-black/30 border text-white px-3 py-2 rounded-sm font-minecraft text-sm outline-none transition-all appearance-none h-10 flex-1 min-w-[110px] ${focused ? 'ring-2 ring-white scale-[1.02] z-10 brightness-125 border-transparent' : 'border-white/10'}`}
                >
                  <option value="">所有版本</option>
                  {MC_VERSIONS.map(v => (<option key={v} value={v}>{v}</option>))}
                  {props.mcVersion && !MC_VERSIONS.includes(props.mcVersion) && (<option value={props.mcVersion}>{props.mcVersion}</option>)}
                </select>
              )}
            </FocusItem>

            <FocusItem>
              {({ ref, focused }) => (
                <select ref={ref as any} value={props.loaderType} onChange={e => props.setLoaderType(e.target.value)} className={`bg-black/30 border text-white px-3 py-2 rounded-sm font-minecraft text-sm outline-none transition-all appearance-none h-10 flex-1 min-w-[110px] ${focused ? 'ring-2 ring-white scale-[1.02] z-10 brightness-125 border-transparent' : 'border-white/10'}`}>
                  <option value="">所有引导器</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="neoforge">NeoForge</option>
                  <option value="quilt">Quilt</option>
                </select>
              )}
            </FocusItem>

            <FocusItem>
              {({ ref, focused }) => (
                <select ref={ref as any} value={props.category} onChange={e => props.setCategory(e.target.value)} className={`bg-black/30 border text-white px-3 py-2 rounded-sm font-minecraft text-sm outline-none transition-all appearance-none h-10 flex-1 min-w-[110px] ${focused ? 'ring-2 ring-white scale-[1.02] z-10 brightness-125 border-transparent' : 'border-white/10'}`}>
                  <option value="">全部分类</option>
                  <option value="technology">科技</option>
                  <option value="magic">魔法</option>
                  <option value="optimization">性能优化</option>
                  <option value="utility">实用工具</option>
                </select>
              )}
            </FocusItem>

            <FocusItem>
              {({ ref, focused }) => (
                <select ref={ref as any} value={props.sort} onChange={e => props.setSort(e.target.value)} className={`bg-black/30 border text-white px-3 py-2 rounded-sm font-minecraft text-sm outline-none transition-all appearance-none h-10 flex-1 min-w-[110px] ${focused ? 'ring-2 ring-white scale-[1.02] z-10 brightness-125 border-transparent' : 'border-white/10'}`}>
                  <option value="relevance">综合排序</option>
                  <option value="downloads">下载最高</option>
                  <option value="updated">最近更新</option>
                </select>
              )}
            </FocusItem>
          </div>

          {/* 4. 下层：搜索与重置按钮 */}
          <div className="flex items-center gap-2">
            
            {/* ✅ 彻底废弃 OreButton，手写扁平化 button 消除残留的阴影和伪边框 */}
            <FocusItem onEnter={props.onSearch}>
              {({ ref, focused }) => (
                <button
                  ref={ref as any} onClick={props.onSearch}
                  className={`flex items-center justify-center px-6 h-10 rounded-sm font-minecraft font-bold text-sm transition-all outline-none flex-shrink-0 text-black 
                  ${focused ? 'ring-2 ring-white scale-[1.02] z-10 shadow-lg brightness-110 bg-ore-green' : 'bg-ore-green/90 hover:bg-ore-green'}`}
                >
                  <Search size={16} className="mr-1.5" /> 搜索
                </button>
              )}
            </FocusItem>

            <FocusItem onEnter={props.onReset}>
              {({ ref, focused }) => (
                <button
                  ref={ref as any} onClick={props.onReset}
                  className={`flex items-center justify-center px-5 h-10 rounded-sm font-minecraft text-sm transition-all outline-none flex-shrink-0 text-gray-300
                  ${focused ? 'ring-2 ring-white scale-[1.02] z-10 shadow-lg brightness-125 bg-white/20' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  <RotateCcw size={16} className="mr-1.5 text-gray-400" /> 重置
                </button>
              )}
            </FocusItem>

          </div>
        </div>

      </div>
    </div>
  );
};