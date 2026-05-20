import React from 'react';
import { Blocks, Filter, Loader2 } from 'lucide-react';

import type { ModListTheme } from '../../modListShared';

interface ModListEmptyStateProps {
  variant: 'loading' | 'empty' | 'filtered';
  emptyMessage?: string;
  listTheme?: ModListTheme;
}

export const ModListEmptyState: React.FC<ModListEmptyStateProps> = ({
  variant,
  emptyMessage,
  listTheme = 'dark'
}) => {
  const isLightTheme = listTheme === 'light';
  const panelClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#F2F3F5] shadow-[0_0.25rem_0_#767A82]'
    : '';
  const panelStyle = isLightTheme
    ? undefined
    : {
        backgroundColor: 'var(--ore-downloadDetail-surface)',
        borderColor: 'var(--ore-downloadDetail-divider)',
        boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
      };
  const iconClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#D7DADF] text-[#202226]'
    : 'text-[var(--ore-downloadDetail-labelText)]';
  const iconStyle = isLightTheme
    ? undefined
    : {
        backgroundColor: 'var(--ore-downloadDetail-base)',
        borderColor: 'var(--ore-downloadDetail-divider)',
        boxShadow: 'var(--ore-downloadDetail-sectionInset)'
      };

  if (variant === 'loading') {
    return (
      <div className="flex justify-center px-4 py-12">
        <div
          className={`flex items-center gap-3 border-[0.125rem] px-4 py-3 text-[1.0625rem] ${
            isLightTheme
              ? 'border-[#1E1E1F] bg-[#F2F3F5] text-[#202226] shadow-[0_0.25rem_0_#767A82]'
              : 'text-[var(--ore-downloadDetail-labelText)]'
          }`}
          style={panelStyle}
        >
          <Loader2 size={18} className="animate-spin text-ore-green" />
          正在加载模组...
        </div>
      </div>
    );
  }

  if (variant === 'empty') {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className={`w-full max-w-xl rounded-sm border-[0.125rem] px-6 py-10 text-center ${panelClass}`} style={panelStyle}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm border-[0.125rem] ${iconClass}`} style={iconStyle}>
            <Blocks size={22} />
          </div>
          <h3 className={`text-[1.0625rem] font-semibold ${isLightTheme ? 'text-[#111214]' : 'text-white'}`}>模组列表为空</h3>
          <p className={`mt-2 text-[1.0625rem] ${isLightTheme ? 'text-[#4D535C]' : 'text-[var(--ore-downloadDetail-labelText)]'}`}>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className={`flex h-12 w-12 items-center justify-center border ${
          isLightTheme ? 'border-[#1E1E1F] bg-[#F2F3F5] text-[#202226]' : 'border-white/10 bg-white/[0.04] text-[#B8BBC2]'
        }`}
      >
        <Filter size={22} />
      </div>
      <div className={`text-[1.0625rem] font-semibold ${isLightTheme ? 'text-[#111214]' : 'text-white'}`}>
        没有匹配当前过滤器的模组
      </div>
      <div className={`max-w-xl text-[1.0625rem] leading-relaxed ${isLightTheme ? 'text-[#4D535C]' : 'text-[#A5A7AD]'}`}>
        切换到“全部”或调整上方搜索关键词后再查看。
      </div>
    </div>
  );
};
