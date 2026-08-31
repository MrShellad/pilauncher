import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreTag } from '../../../ui/primitives/OreTag';
import type { WardrobeProfile, WardrobeCape, WardrobeSkinModel } from '../types';
import { WardrobeCapeCardPreview } from './WardrobeCapeCardPreview';

export interface WardrobeCapePanelProps {
  isMicrosoft: boolean;
  isLoadingProfile: boolean;
  profile: WardrobeProfile | null;
  activeCape: WardrobeCape | null;
  currentSkinUrl: string | null;
  currentSkinModel: WardrobeSkinModel;
  onOpenCapeMenu: (cape: WardrobeCape) => void;
  onPreview: (cape: WardrobeCape) => void;
}

interface CapeCardItemProps {
  cape: WardrobeCape;
  isActive: boolean;
  currentSkinUrl: string | null;
  currentSkinModel: WardrobeSkinModel;
  onOpenCapeMenu: (cape: WardrobeCape) => void;
  onPreview: (cape: WardrobeCape) => void;
}

const CapeCardItem = React.memo(({
  cape,
  isActive,
  currentSkinUrl,
  currentSkinModel,
  onOpenCapeMenu,
  onPreview,
}: CapeCardItemProps) => {
  const { t } = useTranslation();
  const isComponentFocusedRef = React.useRef(false);

  useInputAction('ACTION_Y', () => {
    if (isComponentFocusedRef.current) {
      onPreview(cape);
    }
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onPreview(cape);
  };

  return (
    <FocusItem
      focusKey={`wardrobe-cape-${cape.id}`}
      onEnter={() => onOpenCapeMenu(cape)}
    >
      {({ ref, focused }) => {
        isComponentFocusedRef.current = focused;
        return (
          <button
            ref={ref as any}
            type="button"
            className={`group relative flex w-full flex-col justify-between border-[2px] p-2 text-left transition-none select-none focus:outline-none ${
              focused ? 'ring-2 ring-white scale-[1.02] z-10' : ''
            } ${
              isActive
                ? 'border-[#6CC349] bg-[#3C8527]/25 shadow-[inset_0_2px_0_rgba(108,195,73,0.3),inset_0_-2px_0_rgba(0,0,0,0.4)]'
                : 'border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
            } active:translate-y-[2px] cursor-pointer`}
            onClick={() => onOpenCapeMenu(cape)}
            onContextMenu={handleContextMenu}
          >
            {/* 固定 4:5 标准角色比例下沉矿槽 */}
            <div className="relative flex w-full aspect-[4/5] min-h-[156px] items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] mb-2">
              {isActive && (
                <div className="absolute top-1.5 left-1.5 z-10">
                  <OreTag variant="success" size="sm" weight="bold">
                    {t('wardrobe.activeBadge', { defaultValue: '已穿戴' })}
                  </OreTag>
                </div>
              )}
              <WardrobeCapeCardPreview
                capeUrl={cape.url}
                skinUrl={currentSkinUrl}
                skinModel={currentSkinModel}
                className="w-full h-full object-contain"
              />
            </div>

            {/* 底部信息栏 */}
            <div className="flex w-full flex-col min-w-0 px-0.5">
              <span className="truncate text-xs font-bold text-white font-minecraft">
                {cape.id.replace(/^cape-/i, '') || 'Minecraft Cape'}
              </span>
              <span
                className="truncate text-[10px] text-[#8C8D90] font-['JetBrains_Mono',monospace]"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {isActive ? '当前已启用' : '官方披风'}
              </span>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

export const WardrobeCapePanel: React.FC<WardrobeCapePanelProps> = ({
  isMicrosoft,
  isLoadingProfile,
  profile,
  activeCape,
  currentSkinUrl,
  currentSkinModel,
  onOpenCapeMenu,
  onPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full font-minecraft select-none pb-4">
      {!isMicrosoft && (
        <div className="flex flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] p-8 text-center text-xs text-[#8C8D90] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
          <ShieldAlert className="mb-2 h-8 w-8 text-[#FFE866]" />
          <span>{t('wardrobe.microsoftRequired', { defaultValue: '披风同步仅支持已登录的官方正版微软账号。' })}</span>
        </div>
      )}

      {isMicrosoft && isLoadingProfile && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3 justify-start content-start">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="w-full aspect-[3/4] min-h-[200px] animate-pulse border-[2px] border-[#1E1E1F] bg-[#222324] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          ))}
        </div>
      )}

      {isMicrosoft && !isLoadingProfile && profile?.capes.length === 0 && (
        <div className="flex flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] p-8 text-center text-xs text-[#8C8D90] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
          <span>{t('wardrobe.noCapes', { defaultValue: '当前微软账号下暂无官方披风资产。' })}</span>
        </div>
      )}

      {isMicrosoft && !isLoadingProfile && !!profile?.capes.length && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3.5 justify-center content-start">
          {[...profile.capes]
            .sort((a, b) => {
              const aActive = activeCape?.id === a.id;
              const bActive = activeCape?.id === b.id;
              return aActive === bActive ? 0 : aActive ? -1 : 1;
            })
            .map((cape) => (
              <CapeCardItem
                key={cape.id}
                cape={cape}
                isActive={activeCape?.id === cape.id}
                currentSkinUrl={currentSkinUrl}
                currentSkinModel={currentSkinModel}
                onOpenCapeMenu={onOpenCapeMenu}
                onPreview={onPreview}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default WardrobeCapePanel;