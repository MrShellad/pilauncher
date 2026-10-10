import React from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

import type { OreProjectVersion } from '../../../../resource-catalog';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../../../ui/primitives/OreOverlayScrollArea';
import type { MissingDependencyInfo } from './resolveMissingDependencies';

export const MissingDependenciesModal: React.FC<{
  isOpen: boolean;
  version: OreProjectVersion | null;
  missingDeps: MissingDependencyInfo[];
  autoInstallDeps: boolean;
  isChecking: boolean;
  onToggleAutoInstall: () => void;
  onClose: () => void;
  onConfirm: () => void;
  isBatch?: boolean;
  batchCount?: number;
}> = ({
  isOpen,
  version,
  missingDeps,
  autoInstallDeps,
  isChecking,
  onToggleAutoInstall,
  onClose,
  onConfirm,
  isBatch = false,
  batchCount = 0
}) => {
  if (!isOpen || (!version && !isBatch)) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="检查前置依赖"
      defaultFocusKey={isChecking ? 'instance-deps-cancel' : 'instance-deps-confirm'}
      className="w-full max-w-[34rem]"
      contentClassName="flex flex-col gap-4 overflow-hidden bg-[var(--ore-modal-bg)] p-5"
      actionsClassName="px-5 py-4"
      actions={(
        <>
          <OreButton focusKey="instance-deps-cancel" variant="secondary" size="auto" onClick={onClose}>
            取消
          </OreButton>
          <OreButton
            focusKey="instance-deps-confirm"
            variant="primary"
            size="auto"
            disabled={isChecking}
            onClick={onConfirm}
            className="font-bold tracking-widest text-black"
          >
            确认下载
          </OreButton>
        </>
      )}
    >
      <div className="border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] px-4 py-3 shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.28),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.08)]">
        <div className="mb-2 font-minecraft text-[0.75rem] uppercase leading-none tracking-[0.16em] text-[var(--ore-text-muted)]">
          准备部署到当前实例
        </div>
        <div className="truncate font-minecraft text-[1rem] leading-[1.25] text-[var(--ore-btn-primary-bg)] ore-text-shadow">
          {isBatch ? `已选择 ${batchCount} 个组件/模组` : version?.file_name}
        </div>
      </div>

      {isChecking ? (
        <div className="flex min-h-[8rem] items-center justify-center border-[0.125rem] border-[var(--ore-border-color)] bg-[#111112] px-4 py-5 shadow-[inset_0_0.1875rem_0_rgba(255,255,255,0.04),inset_0_-0.25rem_0_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 font-minecraft text-[0.8125rem] leading-none tracking-[0.08em] text-[var(--ore-btn-primary-bg)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="translate-y-px">正在分析当前实例缺少的必需前置...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="border-[0.125rem] border-[#8A6A22] bg-[#221B10] shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.32),inset_0.125rem_0.125rem_0_rgba(255,229,138,0.12)]">
            <div className="flex items-center gap-3 border-b-[0.125rem] border-[#8A6A22]/70 bg-[#3A2B12] px-4 py-3 text-[#F5C542]">
              <AlertTriangle size={18} className="shrink-0" strokeWidth={2.5} />
              <div className="font-minecraft text-[0.875rem] leading-none tracking-[0.08em]">
                当前实例缺少 <span className="text-white">{missingDeps.length}</span> 个必需前置
              </div>
            </div>
            <OreOverlayScrollArea
              className="max-h-28"
              viewportClassName="max-h-28"
              contentClassName="py-3 pl-4"
              safeInsetTop={8}
              safeInsetBottom={8}
              safeInsetRight={5}
              contentSafePaddingRight={24}
            >
              <div className="flex flex-wrap gap-2">
                {missingDeps.map((dep) => (
                  <span
                    key={dep.id}
                    className="max-w-full truncate border-[0.125rem] border-[#B88A24] bg-[#0B0905] px-2 py-1 font-minecraft text-[0.75rem] leading-none tracking-[0.06em] text-[#FFF2B8] shadow-[inset_0_-0.125rem_0_rgba(0,0,0,0.55)]"
                  >
                    {dep.name}
                  </span>
                ))}
              </div>
            </OreOverlayScrollArea>
          </div>

          <FocusItem focusKey="instance-deps-auto-install" onEnter={onToggleAutoInstall}>
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                type="button"
                onClick={onToggleAutoInstall}
                aria-pressed={autoInstallDeps}
                className={`group flex w-full items-center gap-3 border-[0.125rem] px-4 py-3 text-left outline-none transition-none ${
                  focused
                    ? 'border-[var(--ore-focus-ringFallback)] bg-[#3A3B3D] drop-shadow-[0_0_0.5rem_var(--ore-focus-glow)]'
                    : 'border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] hover:bg-[#343538]'
                }`}
                style={{
                  boxShadow: focused
                    ? 'inset 0 -0.25rem var(--ore-btn-secondary-shadow), inset 0.125rem 0.125rem var(--ore-btn-secondary-highlight)'
                    : 'inset 0 -0.25rem rgba(0,0,0,0.28), inset 0.125rem 0.125rem rgba(255,255,255,0.08)'
                }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-[0.125rem] transition-none ${
                    autoInstallDeps
                      ? 'border-[#1E1E1F] bg-[var(--ore-btn-primary-bg)] text-black shadow-[inset_0_-0.1875rem_0_var(--ore-btn-primary-shadow),inset_0.125rem_0.125rem_0_var(--ore-btn-primary-hl1)]'
                      : 'border-[var(--ore-border-color)] bg-[#111112] text-transparent shadow-[inset_0_0.1875rem_0_rgba(0,0,0,0.4)]'
                  }`}
                  aria-hidden="true"
                >
                  <Check size={15} strokeWidth={3.5} className="translate-y-[-0.0625rem]" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span
                    className={`font-minecraft text-[0.875rem] uppercase leading-none tracking-[0.12em] ${
                      focused ? 'text-white ore-text-shadow' : 'text-[#F4F4F5] group-hover:text-white'
                    }`}
                  >
                    自动下载并补全前置
                  </span>
                  <span className="text-[0.75rem] leading-[1.35] text-[#C8CBD0] group-hover:text-[#E4E6EA]">
                    关闭后只下载当前选择的文件，缺失前置可能导致模组无法加载。
                  </span>
                </span>
              </button>
            )}
          </FocusItem>
        </>
      )}
    </OreModal>
  );
};
