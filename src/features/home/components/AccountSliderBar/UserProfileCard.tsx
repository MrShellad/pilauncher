import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';

interface UserProfileCardProps {
  name: string;
  isPremium: boolean;
  hasPremiumAnywhere: boolean;
  accountsCount: number;
  avatarSrc: string | null;
  onCycleAccount: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  name,
  isPremium,
  hasPremiumAnywhere,
  accountsCount,
  avatarSrc,
  onCycleAccount,
}) => {
  return (
    <div className="ore-ms-profile-card flex flex-col overflow-hidden rounded-none border-[2px] shadow-xl">
      <div className="ore-ms-profile-banner relative h-28 w-full overflow-hidden">
        {avatarSrc ? (
          <img src={avatarSrc} className="h-full w-full object-cover opacity-60 mix-blend-screen blur-sm" alt="" />
        ) : (
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
        )}
        <div className="ore-ms-profile-banner-overlay absolute inset-0 flex items-end p-4">
          <div className="flex items-center gap-3">
            <div
              className={`ore-ms-profile-avatar-box h-14 w-14 flex-shrink-0 overflow-hidden rounded-none ${
                isPremium ? 'is-premium' : ''
              }`}
            >
              <img
                src={avatarSrc || 'https://cravatar.cn/avatars/8667ba71b85a4004af54457a9734eed7?size=64&overlay=true'}
                className="h-full w-full object-cover rendering-pixelated"
                alt="Avatar"
              />
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className={`text-lg font-bold font-minecraft ${isPremium ? 'text-[#FBBF24]' : 'text-white'}`}>
                {name}
              </span>
              <span className="mt-0.5 flex items-center text-[10px] text-gray-300">
                {hasPremiumAnywhere ? (
                  <span className="mr-1.5 rounded-none border border-[#EAB308]/30 bg-[#EAB308]/20 px-1.5 py-0.5 text-[#FBBF24] font-minecraft">
                    正版用户
                  </span>
                ) : (
                  <span className="mr-1.5 rounded-none border border-white/10 bg-white/10 px-1.5 py-0.5 text-gray-300 font-minecraft">
                    Offline 离线
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="ore-ms-profile-action-bar flex items-center justify-between p-3">
        <span className="text-xs font-minecraft text-gray-400">当前活动身份</span>
        {accountsCount > 1 && (
          <OreButton
            variant="secondary"
            size="sm"
            onClick={onCycleAccount}
            className="!h-[clamp(1.75rem,3vh,2.5rem)] !min-w-0 !px-[clamp(0.5rem,0.8vw,1rem)] !py-0 text-[length:clamp(0.625rem,0.8vw,0.9375rem)] !text-[#111214] [&_svg]:!text-[#111214]"
          >
            <RefreshCcw size="clamp(0.75rem,0.9vw,1rem)" className="mr-1" /> 切换
          </OreButton>
        )}
      </div>
    </div>
  );
};
