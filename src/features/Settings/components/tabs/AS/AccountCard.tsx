// src/features/Settings/components/AccountCard.tsx
import React from 'react';
import { Pencil, ImagePlus, Trash2, CheckCircle2 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { MinecraftAccount } from '../../../../../store/useAccountStore';

interface AccountCardProps {
  account: MinecraftAccount;
  isActive: boolean;
  onSetCurrent: (uuid: string) => void;
  onRemove: (uuid: string) => void;
  onEdit: (acc: MinecraftAccount) => void;
  onUploadSkin: (uuid: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account, isActive, onSetCurrent, onRemove, onEdit, onUploadSkin
}) => {
  const isMS = account.type === 'microsoft';

  const renderAvatar = () => {
    if (isMS) {
      return <img src={`https://crafatar.com/avatars/${account.uuid}?overlay=true&size=64`} alt="Avatar" className="w-full h-full rendering-pixelated" />;
    }
    if (account.skinUrl) {
      const basePath = account.skinUrl.split('?')[0];
      const ts = account.skinUrl.split('?')[1];
      const src = convertFileSrc(basePath) + (ts ? `?${ts}` : '');
      return (
        <div className="relative w-full h-full overflow-hidden rendering-pixelated">
          <img src={src} className="absolute max-w-none" alt="Skin" style={{ width: '800%', height: '800%', left: '-100%', top: '-100%' }} />
        </div>
      );
    }
    return <img src="https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7?overlay=true" alt="Steve" className="w-full h-full rendering-pixelated" />;
  };

  return (
    <div className={`
      relative flex flex-col p-5 border-2 rounded-xl transition-all duration-300 
      ${isMS ? 'border-yellow-500/60 bg-gradient-to-b from-yellow-500/10 to-[#141415] shadow-[0_0_20px_rgba(234,179,8,0.15)]' : 'border-[#1E1E1F] bg-[#141415] hover:border-white/10'}
      ${isActive && !isMS ? 'border-ore-green shadow-[0_0_15px_rgba(56,133,39,0.15)]' : ''}
    `}>
      {/* 卡片头部 */}
      <div className="flex flex-col mb-4">
        <div className="flex items-center justify-between min-w-0">
          <span className="text-white font-minecraft text-xl font-bold truncate pr-2">{account.name}</span>
          {isMS ? (
            <OreTag className="!bg-yellow-500/20 !text-yellow-500 !border-yellow-500/30">微软正版</OreTag>
          ) : (
            <OreTag className="!bg-gray-600/30 !text-gray-300 !border-white/10">离线账号</OreTag>
          )}
        </div>
        <span className="text-[10px] text-gray-500 font-mono truncate mt-1.5 opacity-80" title={account.uuid}>
          {isMS ? ((account as any).email || 'Microsoft Account / 隐藏邮箱') : account.uuid}
        </span>
      </div>

      {/* 卡片中心：皮肤头像 */}
      <div className="flex justify-center my-2">
        <div className={`w-20 h-20 bg-[#111112] border-2 shadow-inner overflow-hidden rounded-sm ${isMS ? 'border-yellow-500/30' : 'border-[#2A2A2C]'}`}>
          {renderAvatar()}
        </div>
      </div>

      {/* 卡片下部：操作图标组 */}
      <div className="flex justify-center gap-3 mt-4 mb-5">
        {!isMS && (
          <>
            <button onClick={() => onUploadSkin(account.uuid)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors" title="上传自定义皮肤"><ImagePlus size={18} /></button>
            <button onClick={() => onEdit(account)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="修改名称"><Pencil size={18} /></button>
          </>
        )}
        <button onClick={() => onRemove(account.uuid)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="移除账号"><Trash2 size={18} /></button>
      </div>

      {/* 卡片底部：设为当前按钮 */}
      <div className="mt-auto">
        {isActive ? (
          <div className="w-full py-2.5 flex items-center justify-center bg-white/5 border border-white/10 text-gray-400 text-sm font-minecraft rounded-md cursor-default">
            <CheckCircle2 size={16} className={`mr-2 ${isMS ? 'text-yellow-500' : 'text-ore-green'}`} /> 当前使用中
          </div>
        ) : (
          <button
            onClick={() => onSetCurrent(account.uuid)}
            className={`w-full py-2.5 flex items-center justify-center text-sm font-minecraft font-bold transition-all rounded-md tracking-wider
              ${isMS 
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border-none' 
                : 'bg-[#2A2A2C] hover:bg-ore-green hover:text-black text-gray-300 border border-[#1E1E1F]'
              }
            `}
          >
            设为当前账号
          </button>
        )}
      </div>
    </div>
  );
};