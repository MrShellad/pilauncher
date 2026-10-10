import type React from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { ShimmerOverlay } from '../../../../download';

interface ResourceGridContext {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed?: boolean;
  onRetryLoadMore?: () => void;
}

export const ResourceGridFooter: React.FC<{ context?: ResourceGridContext; isDoubleColumn?: boolean }> = ({ context, isDoubleColumn = false }) => {
  if (!context) return null;
  const { hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore } = context;

  if (loadMoreFailed) {
    return (
      <div className="col-span-full flex h-16 items-center justify-center gap-3">
        <span className="text-sm text-red-400 font-minecraft font-bold">加载失败，请重试</span>
        <button
          onClick={onRetryLoadMore}
          className="rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-1.5 text-xs font-minecraft font-bold tracking-wider text-ore-green hover:bg-ore-green/20 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          手动继续加载
        </button>
      </div>
    );
  }

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div className="col-span-full overflow-hidden w-full">
      <AnimatePresence mode="popLayout">
        {isLoadingMore && (
          <motion.div
            key="loadmore-skeletons"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} gap-[0.75rem] w-full pt-[0.75rem] px-[1rem]`}
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <ResourceCardSkeleton key={`loadmore-skeleton-${i}`} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export const ResourceGridHeader: React.FC = () => {
  return <div className="col-span-full h-[1.5rem] w-full" />;
};


export const ResourceCardSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#C6C8CB]/60"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#48494A]/20" />

      <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pr-[1rem]">
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
          <div className="w-[4.75rem] h-[4.75rem] border-[0.125rem] border-[#1E1E1F] bg-[#48494A]/30 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)]" />
          <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
            <div className="h-[1.375rem] w-[1.375rem] bg-[#48494A]/20 border-[0.125rem] border-[#262729]" />
            <div className="h-[1.375rem] w-[1.375rem] bg-[#48494A]/20 border-[0.125rem] border-[#262729]" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-[0.75rem]">
              <div className="h-5 w-36 bg-[#48494A]/30 rounded-sm" />
              <div className="h-4 w-20 bg-[#48494A]/20 rounded-sm" />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-4 w-[90%] bg-[#48494A]/25 rounded-sm" />
              <div className="h-4 w-[60%] bg-[#48494A]/25 rounded-sm" />
            </div>
          </div>

          <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
            <div className="flex h-full min-w-0 items-center gap-[0.4375rem] overflow-hidden">
              <div className="h-[1.375rem] w-14 bg-[#90A6D6]/30 border-[0.125rem] border-[#262729] rounded-sm" />
              <div className="h-[1.375rem] w-14 bg-[#90A6D6]/30 border-[0.125rem] border-[#262729] rounded-sm" />
            </div>
            <div className="flex h-full items-center gap-x-[0.875rem] text-[#161719]/40">
              <div className="h-4 w-12 bg-[#48494A]/20 rounded-sm" />
              <div className="h-4 w-12 bg-[#48494A]/20 rounded-sm" />
              <div className="h-4 w-16 bg-[#48494A]/20 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
      <ShimmerOverlay />
    </motion.div>
  );
};
