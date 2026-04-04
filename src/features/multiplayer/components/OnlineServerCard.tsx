import React from 'react';
import { Globe, MessageSquareShare, Server } from 'lucide-react';
import type { OnlineServer } from '../types';
import { openLink } from '../utils';
import { FocusItem } from '../../../ui/focus/FocusItem';

interface OnlineServerCardProps {
  server: OnlineServer;
  onArrowPress: (direction: string) => boolean | void;
  onClick?: (server: OnlineServer) => void;
}

const localizeServerType = (server: OnlineServer): string => {
  const normalizedType = server.serverType?.trim().toLowerCase();
  if (server.isModded || normalizedType === 'modded') {
    return 'MOD服';
  }
  return server.serverType;
};

export const OnlineServerCard: React.FC<OnlineServerCardProps> = ({ server, onArrowPress, onClick }) => {
  const serverTypeLabel = localizeServerType(server);
  const isModdedType = server.isModded || server.serverType?.trim().toLowerCase() === 'modded';

  return (
    <article
      className="ore-multiplayer-server-card group relative flex flex-col overflow-hidden rounded-sm border border-transparent bg-[#FAFAFA] transition-all hover:border-[#FFE866]/50 cursor-pointer"
      onClick={() => onClick?.(server)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onClick?.(server);
        }
      }}
    >
      <div className="relative h-[160px] md:h-[180px] 2xl:h-[220px] w-full overflow-hidden border-b-2 border-[#1e1e1f] bg-[#1e1e1f]">
        {server.hero ? (
          <img
            src={server.hero}
            alt={server.name}
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : server.icon ? (
          <img
            src={server.icon}
            alt={server.name}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2E2E30] to-[#1E1E1F]">
            <Server size={48} className="text-[#58585A] opacity-50" />
          </div>
        )}

        {server.isSponsored && (
          <div className="absolute top-0 right-0 z-10 border-b-2 border-l-2 border-[#D4C15A] bg-[var(--ore-color-background-warning-default,#FFE866)] px-3 py-1 font-minecraft text-[10px] text-black shadow-md md:text-xs">
            推广
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-3">
            <h3 className="m-0 min-w-0 flex-1 truncate font-minecraft text-xl leading-none tracking-wide text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)] md:text-2xl 2xl:text-3xl">
              {server.name}
            </h3>

            <div className="inline-flex min-w-[170px] items-center justify-end gap-2 text-white">
              <svg viewBox="0 0 16 16" className="h-5 w-5 shrink-0 md:h-[22px] md:w-[22px]" fill="none" aria-hidden="true">
                <circle cx="8" cy="5.2" r="2.35" fill="#6CC349" stroke="#000000" strokeWidth="1.1" />
                <path d="M3.25 13.25c0-2.3 2.2-4.15 4.75-4.15s4.75 1.85 4.75 4.15" stroke="#000000" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <span className="inline-flex items-center font-minecraft text-[13px] leading-none drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)] md:text-[15px]">
                {server.onlinePlayers}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5">
              {serverTypeLabel && (
                <span className="inline-flex h-[28px] items-center gap-1.5 border border-white/10 bg-black/60 px-2 py-1 text-[13px] font-normal text-white/90 shadow-inner md:h-[30px] md:text-[14px]">
                  {isModdedType && (
                    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]" fill="none" aria-hidden="true">
                      <path d="M6.1 2.25h3.8l.65 1.7h2.5v2.1h-1.05l-.55 1.35v4.3H4.55v-4.3L4 6.05H2.95v-2.1h2.5l.65-1.7Z" stroke="currentColor" strokeWidth="1.1" />
                      <circle cx="6.1" cy="8.35" r="0.8" fill="currentColor" />
                      <circle cx="9.9" cy="8.35" r="0.8" fill="currentColor" />
                    </svg>
                  )}
                  <span className="inline-flex items-center leading-none">{serverTypeLabel}</span>
                </span>
              )}
              {server.versions && server.versions.length > 0 && (
                <span className="inline-flex h-[28px] items-center border border-white/10 bg-black/60 px-2 py-1 text-[13px] font-normal text-white/90 shadow-inner md:h-[30px] md:text-[14px]">
                  {server.versions.join(', ')}
                </span>
              )}
            </div>

            <div className="flex min-w-[170px] items-center justify-end gap-2 self-end">
              {server.hasPaidFeatures && (
                <span className="inline-flex h-[28px] items-center gap-1.5 border border-black/30 bg-[#FFE866] px-2 py-1 text-[13px] font-normal text-[#C33636] shadow-inner md:h-[30px] md:text-[14px]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]" fill="none" aria-hidden="true">
                    <path d="M3 5.25h10v7.5H3z" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M5 5.25V4a3 3 0 0 1 6 0v1.25" stroke="currentColor" strokeWidth="1.1" />
                    <circle cx="8" cy="8.95" r="1.1" fill="currentColor" />
                  </svg>
                  <span className="inline-flex items-center leading-none">含付费</span>
                </span>
              )}
              {server.ageRecommendation && (
                <span className="inline-flex h-[28px] items-center gap-1.5 border border-black/40 bg-white/20 px-2 py-1 text-[13px] font-normal text-white shadow-inner backdrop-blur-md md:h-[30px] md:text-[14px]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]" fill="none" aria-hidden="true">
                    <path d="M8 2.2 12.5 4v3.9c0 2.45-1.67 4.47-4.5 5.9-2.83-1.43-4.5-3.45-4.5-5.9V4L8 2.2Z" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M8 5.6v3.4M8 11.1h.01" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                  <span className="inline-flex items-center leading-none">{server.ageRecommendation}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 bg-gradient-to-b from-[#FFFFFF] to-[#F8F8F8] p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(() => {
            const allTags = [...(server.features || []), ...(server.mechanics || []), ...(server.elements || [])];
            if (allTags.length > 0) {
              return allTags.map((feat, idx) => (
                <div
                  key={idx}
                  className="flex max-w-full items-center gap-1 border border-black/10 bg-white/85 px-2 py-1 shadow-sm"
                  style={{ borderColor: feat.color ? `${feat.color}45` : '' }}
                >
                  {feat.iconSvg && (
                    <div
                      className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center opacity-90 md:h-4 md:w-4"
                      dangerouslySetInnerHTML={{ __html: feat.iconSvg }}
                      style={{ color: feat.color || '#2F2F2F' }}
                    />
                  )}
                  <span className="truncate text-[11px] font-normal leading-none md:text-xs" style={{ color: feat.color || '#2F2F2F' }}>
                    {feat.label}
                  </span>
                </div>
              ));
            }

            return <span className="py-1 text-[11px] italic text-black/45 md:text-xs">精选标签中</span>;
          })()}
        </div>

        {server.socials && server.socials.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-black/10 pt-2 md:pt-3">
            {server.socials.map((social, idx) => {
              if (!social.url) return null;
              const isWebsite =
                social.label.toLowerCase().includes('网页') ||
                social.label.toLowerCase().includes('官网') ||
                social.label.toLowerCase().includes('web');

              return (
                <FocusItem
                  key={idx}
                  focusKey={`server-${server.id}-social-${idx}`}
                  onArrowPress={onArrowPress}
                  onEnter={() => void openLink(social.url!)}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      className={`flex h-7 w-7 items-center justify-center border border-black/20 bg-white/70 transition-colors hover:bg-white/90 active:bg-white md:h-8 md:w-8 ${
                        focused ? 'outline outline-2 outline-black outline-offset-1' : ''
                      }`}
                      title={social.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        void openLink(social.url!);
                      }}
                      tabIndex={-1}
                    >
                      {isWebsite ? <Globe size={14} className="text-black/80" /> : <MessageSquareShare size={14} className="text-black/80" />}
                    </button>
                  )}
                </FocusItem>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};
