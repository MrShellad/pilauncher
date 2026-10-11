import React, { useCallback, useEffect, useRef } from 'react';
import { Check, Copy, Play, X } from 'lucide-react';

import { FocusItem } from '@/ui/focus/FocusItem';
import { useInputAction, type InputMode } from '@/ui/focus/InputDriver';
import type { OnlineServer } from '../types';
import type { OnlineServerFooterFeature } from './onlineServerCardModel';

type CopyState = 'idle' | 'success' | 'error';

const CardYHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({
  focused,
  onAction,
}) => {
  const actionRef = useRef(onAction);

  useEffect(() => {
    actionRef.current = onAction;
  }, [onAction]);

  useInputAction(
    'ACTION_Y',
    useCallback(() => {
      if (focused) {
        actionRef.current();
      }
    }, [focused])
  );

  return null;
};

const FooterFeatureIcon: React.FC<{ feature: OnlineServerFooterFeature }> = ({ feature }) => {
  const Icon = feature.icon;
  const iconStyle = feature.color ? { color: feature.color } : undefined;

  if (feature.iconSvg?.startsWith('<svg')) {
    return (
      <span
        className="flex h-[1.75rem] w-[1.75rem] items-center justify-center [&_svg]:h-full [&_svg]:w-full"
        style={iconStyle}
        dangerouslySetInnerHTML={{ __html: feature.iconSvg }}
      />
    );
  }

  return <Icon className="h-[1.75rem] w-[1.75rem]" style={iconStyle} />;
};

interface OnlineServerCardFooterProps {
  server: OnlineServer;
  footerFeatures: OnlineServerFooterFeature[];
  copyState: CopyState;
  inputMode: InputMode;
  onArrowPress: (direction: string) => boolean | void;
  onCopyIp: () => void;
  onPlay: () => void;
  onToggleDrawer: () => void;
  onChildFocused: () => void;
  canPlay: boolean;
}

export const OnlineServerCardFooter: React.FC<OnlineServerCardFooterProps> = ({
  server,
  footerFeatures,
  copyState,
  inputMode,
  onArrowPress,
  onCopyIp,
  onPlay,
  onToggleDrawer,
  onChildFocused,
  canPlay,
}) => (
  <div className="absolute bottom-0 z-30 flex h-[5.5rem] w-full flex-row border-t border-white/15 bg-black/40 backdrop-blur-xl">
    <div className="z-30 flex h-full flex-1 flex-row divide-x divide-white/15 overflow-hidden">
      {footerFeatures.map((feature) => (
        <div
          key={`${feature.title}-${feature.subtitle}`}
          className={`${feature.minWidthClass || 'flex'} min-w-0 flex-1 flex-row items-center justify-center gap-[0.75rem] px-[0.5rem]`}
        >
          <div className="flex flex-shrink-0 items-center justify-center text-gray-300">
            <FooterFeatureIcon feature={feature} />
          </div>
          <div className="flex min-w-0 -translate-y-[0.125rem] flex-col justify-center gap-[0.375rem] text-left">
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[1rem] font-bold leading-none text-white">
              {feature.title}
            </span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.75rem] leading-none text-gray-400">
              {feature.subtitle}
            </span>
          </div>
        </div>
      ))}
    </div>

    <div className="z-30 flex h-full flex-row items-stretch shadow-[-0.625rem_0_1.25rem_rgba(0,0,0,0.3)]">
      <FocusItem
        focusKey={`server-card-${server.id}-copy`}
        onArrowPress={onArrowPress}
        onEnter={onCopyIp}
        onFocus={onChildFocused}
        autoScroll={false}
      >
        {({ ref, focused }) => (
          <>
            <CardYHandler focused={focused} onAction={onToggleDrawer} />
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              className={`flex h-full w-[5.5rem] items-center justify-center border-l border-white/15 text-white transition-[background-color,color,filter] hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-50 ${
                focused && inputMode !== 'mouse'
                  ? 'z-10 bg-black/65 text-green-200 brightness-110 outline outline-[3px] outline-[#F5C542] -outline-offset-[3px]'
                  : 'bg-black/35'
              }`}
              onClick={onCopyIp}
              disabled={!server.address}
              tabIndex={-1}
              title={
                copyState === 'success'
                  ? '已复制 IP'
                  : copyState === 'error'
                    ? '复制失败'
                    : '复制 IP'
              }
            >
              {copyState === 'success' ? (
                <Check className="h-[1.5rem] w-[1.5rem] text-green-300" />
              ) : copyState === 'error' ? (
                <X className="h-[1.5rem] w-[1.5rem] text-red-300" />
              ) : (
                <Copy className="h-[1.5rem] w-[1.5rem]" />
              )}
            </button>
          </>
        )}
      </FocusItem>

      <FocusItem
        focusKey={`server-card-${server.id}-play`}
        onArrowPress={onArrowPress}
        onEnter={onPlay}
        onFocus={onChildFocused}
        autoScroll={false}
      >
        {({ ref, focused }) => (
          <>
            <CardYHandler focused={focused} onAction={onToggleDrawer} />
            <button
              ref={ref as React.RefObject<HTMLButtonElement>}
              type="button"
              className={`flex h-full flex-row items-center justify-center gap-[1rem] border-l px-[2rem] text-white transition-[background-color,border-color,filter] hover:border-[#C084FC] hover:bg-[#9333EA] disabled:cursor-not-allowed disabled:opacity-60 md:px-[3rem] ${
                focused && inputMode !== 'mouse'
                  ? 'z-10 border-[#C084FC] bg-[#9333EA] brightness-110 outline outline-[3px] outline-[#F5C542] -outline-offset-[3px]'
                  : 'border-[#83C148] bg-[#5B8731]'
              }`}
              onClick={onPlay}
              disabled={!canPlay}
              tabIndex={-1}
            >
              <Play className="h-[2rem] w-[2rem] fill-current drop-shadow-md" />
              <span className="whitespace-nowrap text-[1.25rem] font-black leading-none drop-shadow">
                立即加入
              </span>
            </button>
          </>
        )}
      </FocusItem>
    </div>
  </div>
);
