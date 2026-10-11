import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { ShimmerOverlay } from './ShimmerOverlay';

interface ResourceGridContext {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed?: boolean;
  onRetryLoadMore?: () => void;
}

interface ResourceGridFooterProps {
  context?: ResourceGridContext;
  isDoubleColumn?: boolean;
}

export const ResourceGridFooter: React.FC<ResourceGridFooterProps> = ({
  context,
  isDoubleColumn = false,
}) => {
  if (!context) return null;
  const { hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore } = context;

  if (loadMoreFailed) {
    return (
      <div className="col-span-full flex h-16 items-center justify-center gap-3 pb-6">
        <span className="font-minecraft text-sm font-bold text-red-400">加载失败，请重试</span>
        <button
          onClick={onRetryLoadMore}
          className="cursor-pointer rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-1.5 font-minecraft text-xs font-bold tracking-wider text-ore-green transition-colors hover:bg-ore-green/20 hover:text-white active:scale-95"
        >
          手动继续加载
        </button>
      </div>
    );
  }

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div className="col-span-full w-full overflow-hidden pb-6">
      <AnimatePresence mode="popLayout">
        {isLoadingMore && (
          <motion.div
            key="loadmore-skeletons"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} w-full gap-[0.75rem] px-[1rem] pt-[0.75rem]`}
          >
            {Array.from({ length: 2 }).map((_, index) => (
              <ResourceCardSkeleton key={`loadmore-skeleton-${index}`} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ResourceGridHeader: React.FC = () => (
  <div className="col-span-full h-[1.5rem] w-full" />
);

export const ResourceCardSkeleton: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className="relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#C6C8CB]/60"
  >
    <div className="absolute inset-y-0 left-0 w-1.5 bg-[#48494A]/20" />

    <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pr-[1rem]">
      <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
        <div className="h-[4.75rem] w-[4.75rem] border-[0.125rem] border-[#1E1E1F] bg-[#48494A]/30 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)]" />
        <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
          <div className="h-[1.375rem] w-[1.375rem] border-[0.125rem] border-[#262729] bg-[#48494A]/20" />
          <div className="h-[1.375rem] w-[1.375rem] border-[0.125rem] border-[#262729] bg-[#48494A]/20" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-[0.75rem]">
            <div className="h-5 w-36 rounded-sm bg-[#48494A]/30" />
            <div className="h-4 w-20 rounded-sm bg-[#48494A]/20" />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-4 w-[90%] rounded-sm bg-[#48494A]/25" />
            <div className="h-4 w-[60%] rounded-sm bg-[#48494A]/25" />
          </div>
        </div>

        <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
          <div className="flex h-full min-w-0 items-center gap-[0.4375rem] overflow-hidden">
            <div className="h-[1.375rem] w-14 rounded-sm border-[0.125rem] border-[#262729] bg-[#90A6D6]/30" />
            <div className="h-[1.375rem] w-14 rounded-sm border-[0.125rem] border-[#262729] bg-[#90A6D6]/30" />
          </div>
          <div className="flex h-full items-center gap-x-[0.875rem] text-[#161719]/40">
            <div className="h-4 w-12 rounded-sm bg-[#48494A]/20" />
            <div className="h-4 w-12 rounded-sm bg-[#48494A]/20" />
            <div className="h-4 w-16 rounded-sm bg-[#48494A]/20" />
          </div>
        </div>
      </div>
    </div>
    <ShimmerOverlay />
  </motion.div>
);

interface ResourceGridLoadingOverlayProps {
  isDoubleColumn: boolean;
  isLoading: boolean;
}

export const ResourceGridLoadingOverlay: React.FC<ResourceGridLoadingOverlayProps> = ({
  isDoubleColumn,
  isLoading,
}) => (
  <AnimatePresence>
    {isLoading && (
      <motion.div
        key="skeleton-overlay"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="custom-scrollbar absolute inset-0 z-30 overflow-y-auto bg-[#313233] px-[1rem] pt-0"
      >
        <div className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} gap-[0.75rem] pb-[1.5rem] pt-[1.5rem]`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <ResourceCardSkeleton key={index} />
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
