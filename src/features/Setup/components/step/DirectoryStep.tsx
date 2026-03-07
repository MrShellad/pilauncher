// src/features/Setup/components/DirectoryStep.tsx
import React from 'react';
import { ShieldCheck, FolderOpen } from 'lucide-react';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';

interface DirectoryStepProps {
  basePath: string;
  setBasePath: (path: string) => void;
  onBrowse: () => void;
  onConfirm: () => void;
}

export const DirectoryStep: React.FC<DirectoryStepProps> = ({ basePath, setBasePath, onBrowse, onConfirm }) => {
  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-ore-green/20 blur-3xl pointer-events-none" />
      <ShieldCheck size={48} className="text-ore-green mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">初始化数据目录</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        我们需要一个专用的文件夹来存放您的游戏核心与实例。<br/>
        可以是一个<span className="text-white font-bold">全新空目录</span>，也可选择<span className="text-white font-bold">已有的 PiLauncher 旧目录</span>以恢复数据。<br/>
        <span className="text-red-400 font-bold">请注意：路径中绝对不能包含中文！</span>
      </p>

      <div className="flex w-full space-x-2 mb-6 relative z-10">
        <FocusItem focusKey="setup-input-path">
          {({ ref, focused }) => (
            <input 
              ref={ref as any}
              type="text" 
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="请点击浏览按钮选择纯英文目录 ->"
              className={`flex-1 bg-[#141415] border ${focused ? 'border-ore-green ring-1 ring-ore-green' : 'border-ore-gray-border'} text-white px-3 py-2 outline-none transition-colors`}
            />
          )}
        </FocusItem>

        <OreButton focusKey="setup-btn-browse" onClick={onBrowse} variant="secondary" size="auto">
          <FolderOpen size={16} className="mr-2" /> 浏览
        </OreButton>
      </div>

      <OreButton focusKey="setup-btn-confirm" onClick={onConfirm} variant="primary" size="full" className="relative z-10">
        确认并下一步
      </OreButton>
    </>
  );
};