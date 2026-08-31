import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreTag } from '../../../ui/primitives/OreTag';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import type { SkinCardAsset } from '../types';

export interface WardrobeSkinPanelProps {
  skinCards: SkinCardAsset[];
  isLoadingProfile?: boolean;
  onChooseSkin: () => void;
  onOpenSkinMenu: (asset: SkinCardAsset) => void;
  onPreview: (asset: SkinCardAsset) => void;
}

interface SkinCardItemProps {
  asset: SkinCardAsset;
  onOpenSkinMenu: (asset: SkinCardAsset) => void;
  onPreview: (asset: SkinCardAsset) => void;
}

const SkinCardItem = React.memo(({ asset, onOpenSkinMenu, onPreview }: SkinCardItemProps) => {
  const { t } = useTranslation();
  const isComponentFocusedRef = React.useRef(false);

  useInputAction('ACTION_Y', () => {
    if (isComponentFocusedRef.current) {
      onPreview(asset);
    }
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onPreview(asset);
  };

  return (
    <FocusItem
      focusKey={`wardrobe-skin-${asset.id}`}
      onEnter={() => onOpenSkinMenu(asset)}
    >
      {({ ref, focused }) => {
        isComponentFocusedRef.current = focused;
        return (
          <button
            ref={ref as any}
            type="button"
            className={`group relative flex h-full w-full flex-col justify-between border-[2px] p-2 text-left transition-none select-none focus:outline-none ${
              focused ? 'ring-2 ring-white scale-[1.02] z-10' : ''
            } ${
              asset.isActive
                ? 'border-[#6CC349] bg-[#3C8527]/25 shadow-[inset_0_2px_0_rgba(108,195,73,0.3),inset_0_-2px_0_rgba(0,0,0,0.4)]'
                : 'border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:bg-[#525354]'
            } active:translate-y-[2px] cursor-pointer`}
            onClick={() => onOpenSkinMenu(asset)}
            onContextMenu={handleContextMenu}
          >
            {/* 上方 4:5 比例下沉矿槽 */}
            <div className="relative flex w-full aspect-[4/5] min-h-[156px] items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] mb-2">
              {asset.isActive && (
                <div className="absolute top-1.5 left-1.5 z-10">
                  <OreTag variant="success" size="sm" weight="bold">
                    {t('wardrobe.activeBadge', { defaultValue: '已穿戴' })}
                  </OreTag>
                </div>
              )}
              <WardrobeSkinCardPreview skinUrl={asset.skinUrl} model={asset.variant} />
            </div>

            {/* 底部信息栏 */}
            <div className="flex w-full flex-col min-w-0 px-0.5">
              <span className="truncate text-xs font-bold text-white font-minecraft">
                {asset.title}
              </span>
              <span
                className="truncate text-[10px] text-[#8C8D90] font-['JetBrains_Mono',monospace]"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {asset.subtitle}
              </span>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

export const WardrobeSkinPanel: React.FC<WardrobeSkinPanelProps> = ({
  skinCards,
  isLoadingProfile = false,
  onChooseSkin,
  onOpenSkinMenu,
  onPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full font-minecraft select-none pb-4">
      {isLoadingProfile && skinCards.length === 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3 justify-start content-start">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex w-full flex-col justify-between border-[2px] border-[#1E1E1F] bg-[#222324] p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] animate-pulse"
            >
              <div className="w-full aspect-[4/5] min-h-[156px] bg-[#141517] mb-2" />
              <div className="h-4 w-3/4 bg-[#313233] mb-1" />
              <div className="h-3 w-1/2 bg-[#313233]" />
            </div>
          ))}
        </div>
      )}

      {(!isLoadingProfile || skinCards.length > 0) && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3.5 justify-center content-start items-stretch">
          {/* 添加皮肤 3D 基岩槽卡片 (结构与尺寸和普通皮肤卡片 100% 像素级对齐) */}
          <FocusItem focusKey="wardrobe-upload-card" onEnter={onChooseSkin}>
            {({ ref, focused }) => (
              <button
                ref={ref as any}
                type="button"
                className={`group relative flex h-full w-full flex-col justify-between border-[2px] border-dashed border-[#6CC349] bg-[#222324] p-2 text-center transition-none select-none hover:bg-[#28292a] active:translate-y-[2px] focus:outline-none ${
                  focused ? 'ring-2 ring-white scale-[1.02] z-10' : ''
                } shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] cursor-pointer`}
                onClick={onChooseSkin}
              >
                {/* 上方 4:5 比例虚线下沉槽 */}
                <div className="relative flex w-full aspect-[4/5] min-h-[156px] flex-col items-center justify-center border-[2px] border-dashed border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] mb-2 p-2">
                  <div className="flex h-12 w-12 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#244A1B] text-[#6CC349] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group-hover:scale-105 transition-transform">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                </div>

                {/* 底部信息栏 */}
                <div className="flex w-full flex-col min-w-0 px-0.5">
                  <span className="truncate text-xs font-bold text-white font-minecraft">
                    {t('wardrobe.uploadCard.title', { defaultValue: '添加新皮肤' })}
                  </span>
                  <span
                    className="truncate text-[10px] text-[#8C8D90] font-['JetBrains_Mono',monospace]"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {t('wardrobe.uploadCard.subtitle', { defaultValue: '导入本地文件' })}
                  </span>
                </div>
              </button>
            )}
          </FocusItem>

          {/* 皮肤列表 */}
          {skinCards.map((asset) => (
            <SkinCardItem
              key={asset.id}
              asset={asset}
              onOpenSkinMenu={onOpenSkinMenu}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WardrobeSkinPanel;