import React from 'react';
import { Blocks, Filter, Loader2 } from 'lucide-react';

interface ModListEmptyStateProps {
  variant: 'loading' | 'empty' | 'filtered';
  emptyMessage?: string;
}

export const ModListEmptyState: React.FC<ModListEmptyStateProps> = ({ variant, emptyMessage }) => {
  if (variant === 'loading') {
    return (
      <div className="flex justify-center px-4 py-12">
        <div
          className="flex items-center gap-3 border-[0.125rem] px-4 py-3 text-[1.0625rem] text-[var(--ore-downloadDetail-labelText)]"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
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
        <div
          className="w-full max-w-xl rounded-sm border-[0.125rem] px-6 py-10 text-center"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm border-[0.125rem] text-[var(--ore-downloadDetail-labelText)]"
            style={{
              backgroundColor: 'var(--ore-downloadDetail-base)',
              borderColor: 'var(--ore-downloadDetail-divider)',
              boxShadow: 'var(--ore-downloadDetail-sectionInset)'
            }}
          >
            <Blocks size={22} />
          </div>
          <h3 className="text-[1.0625rem] font-semibold text-white">模组列表为空</h3>
          <p className="mt-2 text-[1.0625rem] text-[var(--ore-downloadDetail-labelText)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white/[0.04] text-[#B8BBC2]">
        <Filter size={22} />
      </div>
      <div className="text-[1.0625rem] font-semibold text-white">没有匹配当前过滤器的模组</div>
      <div className="max-w-xl text-[1.0625rem] leading-relaxed text-[#A5A7AD]">
        切换到“全部”或调整上方搜索关键词后再查看。
      </div>
    </div>
  );
};
