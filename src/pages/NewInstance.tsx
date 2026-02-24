// /src/pages/NewInstance.tsx
import React, { useState } from 'react';
import { CustomInstanceView } from '../features/Instances/components/CustomInstanceView';
import { ModpackView } from '../features/Instances/components/ModpackView';

type CreationMode = 'custom' | 'modpack';

const NewInstance: React.FC = () => {
  // 默认为自建实例
  const [mode, setMode] = useState<CreationMode>('custom');

  return (
    <div className="flex flex-col w-full h-full p-6 sm:p-8 bg-black/40 overflow-hidden">
      
      {/* 1. 顶部切换栏 (类似基岩版的选项卡切换) */}
      <div className="flex justify-center w-full mb-8">
        <div className="flex bg-[#1E1E1F] border-2 border-ore-gray-border p-1">
          <button
            onClick={() => setMode('custom')}
            className={`
              px-8 py-2 font-minecraft text-lg tracking-wider transition-all focus:outline-none
              ${mode === 'custom' 
                ? 'bg-ore-green text-white shadow-[inset_0_-3px_rgba(0,0,0,0.2)]' 
                : 'text-ore-text-muted hover:text-white hover:bg-white/5'}
            `}
          >
            自建实例
          </button>
          <button
            onClick={() => setMode('modpack')}
            className={`
              px-8 py-2 font-minecraft text-lg tracking-wider transition-all focus:outline-none
              ${mode === 'modpack' 
                ? 'bg-ore-green text-white shadow-[inset_0_-3px_rgba(0,0,0,0.2)]' 
                : 'text-ore-text-muted hover:text-white hover:bg-white/5'}
            `}
          >
            整合包
          </button>
        </div>
      </div>

      {/* 2. 内容动态渲染区 */}
      <div className="flex-1 overflow-x-hidden relative">
        {mode === 'custom' ? <CustomInstanceView /> : <ModpackView />}
      </div>

    </div>
  );
};

export default NewInstance;