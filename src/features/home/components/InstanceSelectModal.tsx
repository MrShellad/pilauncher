// /src/features/home/components/InstanceSelectModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useInstances } from '../../../hooks/pages/Instances/useInstances';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';
import { OreInstanceCard } from '../../../ui/primitives/OreInstanceCard';
import { OreModal } from '../../../ui/primitives/OreModal';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { formatRelativeTime } from '../../../utils/formatters';

interface InstanceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const InstanceSelectModal: React.FC<InstanceSelectModalProps> = ({
  isOpen,
  onClose,
  selectedId,
  onSelect,
}) => {
  const { instances } = useInstances();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const globalSelectedId = useLauncherStore((state) => state.selectedInstanceId);
  const setSelectedInstanceId = useLauncherStore((state) => state.setSelectedInstanceId);

  const currentSelectedId = selectedId || globalSelectedId || instances[0]?.id || null;
  const q = query.toLowerCase().trim();
  const formatLastPlayed = (lastPlayed: string | undefined) => {
    const normalized = lastPlayed?.trim();

    if (!normalized || normalized.toLowerCase() === 'never') {
      return t('home.neverPlayed', { defaultValue: '从未进行游戏' });
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return t('home.neverPlayed', { defaultValue: '从未进行游戏' });
    }

    return formatRelativeTime(normalized, t);
  };

  const filtered = q
    ? instances.filter((inst) => {
        const name = inst.name.toLowerCase();
        const loader = inst.loader.toLowerCase();
        const version = inst.version.toLowerCase();
        return name.includes(q) || loader.includes(q) || version.includes(q);
      })
    : instances;

  const handleSelect = (id: string) => {
    setSelectedInstanceId(id);
    onSelect(id);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      focusManager.focus('instance-button');
      return;
    }

    setQuery('');

    const focusTimer = setTimeout(() => {
      searchRef.current?.focus();
    }, 120);

    const scrollTimer = setTimeout(() => {
      if (currentCardRef.current && scrollContainerRef.current) {
        currentCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }

      if (currentSelectedId) {
        focusManager.focus(`instance-card-${currentSelectedId}`);
      }
    }, 200);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(scrollTimer);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('home.selectInstanceModal.title')}
      className="w-full max-w-4xl"
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
    >
      <FocusBoundary
        id="instance-select-boundary"
        trapFocus={true}
        onEscape={onClose}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
        >
          {instances.length === 0 ? (
            <div className="m-4 flex h-64 flex-col items-center justify-center border-2 border-dashed border-[#1E1E1F] bg-[#141415]/50">
              <span className="mb-2 font-minecraft tracking-wider text-ore-text-muted">
                {t('home.selectInstanceModal.empty')}
              </span>
              <span className="font-minecraft text-xs text-[#A0A0A0]">
                {t('home.selectInstanceModal.emptyHint')}
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center">
              <span className="font-minecraft text-sm tracking-wider text-ore-text-muted">
                {t('home.selectInstanceModal.noResults', 'No matching instances')}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 p-4 pb-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((instance) => {
                const isCurrent = instance.id === currentSelectedId;

                return (
                  <FocusItem
                    key={instance.id}
                    focusKey={`instance-card-${instance.id}`}
                    onEnter={() => handleSelect(instance.id)}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={(el) => {
                          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
                          if (isCurrent) {
                            (currentCardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                          }
                        }}
                        onClick={() => handleSelect(instance.id)}
                        className={`
                          cursor-pointer rounded-sm transition-all duration-200
                          ${focused ? 'z-10 scale-[1.02] outline outline-[4px] outline-offset-4 outline-white/80 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''}
                        `}
                      >
                        <OreInstanceCard
                          id={instance.id}
                          name={instance.name}
                          mcVersion={instance.version}
                          loaderType={instance.loader}
                          lastPlayed={formatLastPlayed(instance.lastPlayed)}
                          coverUrl={instance.coverUrl}
                          isActive={isCurrent}
                          onClick={() => handleSelect(instance.id)}
                          className="pointer-events-none h-64 w-full"
                        />
                      </div>
                    )}
                  </FocusItem>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="sticky bottom-0 z-10 flex-shrink-0 border-t-[3px] border-[var(--ore-border-color)] bg-[var(--ore-modal-footer-bg)] px-4 py-3"
          style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col">
            <div className="relative flex items-center">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 text-[var(--ore-text-muted)]"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  'home.selectInstanceModal.searchPlaceholder',
                  'Search title, Loader, or MC version...',
                )}
                className={`
                  w-full rounded-sm border-2 border-[var(--ore-border-color)]
                  bg-[var(--ore-input-bg,#0d0d0d)] py-2 pl-9 pr-4 text-sm font-minecraft tracking-wide
                  text-[var(--ore-modal-content-text)] placeholder-[var(--ore-text-muted)]
                  outline-none transition-colors duration-150
                  focus:border-[var(--ore-focus-ring,#7dae4b)]
                `}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 text-xs font-minecraft text-[var(--ore-text-muted)] transition-colors hover:text-white"
                >
                  x
                </button>
              )}
            </div>

            {q && (
              <p className="mt-1.5 pl-1 text-xs font-minecraft text-[var(--ore-text-muted)]">
                {t('home.selectInstanceModal.resultCount', {
                  count: filtered.length,
                  defaultValue: `Found ${filtered.length} instances`,
                })}
              </p>
            )}
          </div>
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
