// src/features/Settings/components/tabs/AS/AccountCard.tsx
import React, { useEffect, useState } from 'react';
import { Pencil, ImagePlus, Trash2, CheckCircle2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { FocusItem } from '../../../../../ui/focus/FocusItem';

// ✅ 引入本地兜底默认头像
import defaultAvatar from '../../../../../assets/home/account/128.png';

interface AccountCardProps {
  account: {
    uuid: string;
    name: string;
    type: string;
    skinUrl?: string | null;
  };
  isActive: boolean;
  onSetCurrent: (uuid: string) => void;
  onRemove: (uuid: string) => void;
  onEdit: (acc: any) => void;
  onUploadSkin: (uuid: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account, isActive, onSetCurrent, onRemove, onEdit, onUploadSkin
}) => {
  const rawType = account.type || (account as any).account_type || (account as any).accountType || '';
  const isMS = rawType.toLowerCase() === 'microsoft';
  const displayName = account.name || (account as any).username || '未知玩家';
  
  const rawUuid = account.uuid || (account as any).id || '';
  const isValidUuid = rawUuid.length >= 32;
  const displayUuid = rawUuid || '8667ba71-b85a-4004-af54-457a9734eed7'; 

  // ✅ 新增状态：存储 Rust 后端返回的本地物理头像路径
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // ✅ 核心机制：组件挂载时，命令 Rust 后端去拉取并返回本地缓存地址
  // 彻底移除 isMS 判断限制，让离线账号也能利用后端的离线兜底引擎
  useEffect(() => {
    const fetchBackendAvatar = async () => {
      try {
        const validId = isValidUuid ? rawUuid : '8667ba71b85a4004af54457a9734eed7';
        // ✅ 必须同时传递 uuid 和 username，对齐后端最新接口
        const localPath = await invoke<string>('get_or_fetch_account_avatar', { 
          uuid: validId,
          username: account.name
        });
        
        // 使用 skinUrl 的时间戳作为稳定的缓存破坏符
        const cacheBuster = account.skinUrl?.split('?t=')[1] || 'init';
        setAvatarSrc(`${convertFileSrc(localPath)}?t=${cacheBuster}`);
        
      } catch (e) {
        console.error("[AccountCard] 后端拉取头像失败:", e);
        // ✅ 抛弃所有外部网络 URL，断网或失败时直接强制使用本地内置资源
        setAvatarSrc(defaultAvatar);
      }
    };
    fetchBackendAvatar();
  }, [rawUuid, isValidUuid, account.name, account.skinUrl]);

  const renderAvatar = () => {
    // 对于离线账号，如果他们手动上传了自定义皮肤 (skin.png)，保留 CSS 展开切图的逻辑，
    // 这样能 100% 准确展示他们自己上传的皮肤面部。
    if (!isMS && account.skinUrl) {
      const basePath = account.skinUrl.split('?')[0];
      const ts = account.skinUrl.split('?')[1];
      const src = convertFileSrc(basePath) + (ts ? `?${ts}` : '');
      return (
        <div className="relative w-full h-full overflow-hidden rendering-pixelated">
          <img src={src} className="absolute max-w-none" alt="Skin" style={{ width: '800%', height: '800%', left: '-100%', top: '-100%' }} />
        </div>
      );
    }
    
    // 正版账号、或者没有上传皮肤的离线账号，统一使用后端下发的本地 avatar.png 或默认图
    return (
      <img 
        src={avatarSrc || defaultAvatar} 
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultAvatar; }}
        alt="Avatar" 
        className={`w-full h-full rendering-pixelated object-cover transition-opacity duration-300 ${avatarSrc ? 'opacity-100' : 'opacity-40'}`} 
      />
    );
  };

  return (
    <div className={`
      relative flex flex-col p-5 rounded-sm ore-account-card transition-colors duration-300 outline-none
      ${isMS ? 'is-premium' : ''}
      ${isActive ? 'is-active' : ''}
    `}>
      <div className="flex items-center mb-6">
        <div className="ore-card-avatar-wrapper flex-shrink-0 mr-4">
          <div className="ore-card-avatar-inner relative w-full h-full bg-[#111112] border shadow-inner overflow-hidden rounded-sm">
            {renderAvatar()}
          </div>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-minecraft text-xl font-bold truncate ore-account-name">
            {displayName}
          </span>
          <span className="text-[10px] font-mono truncate opacity-60 mt-1 ore-account-subtitle" title={displayUuid}>
            {isMS ? 'Minecraft Java Edition' : `Offline UUID: ${displayUuid}`}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-3 mb-5 mt-auto">
        {!isMS && (
          <>
            <FocusItem focusKey={`btn-skin-${account.uuid}`} onEnter={() => onUploadSkin(account.uuid)}>
              {({ ref, focused }) => (
                <button 
                  ref={ref as any} onClick={() => onUploadSkin(account.uuid)} tabIndex={-1}
                  className={`p-2 rounded-lg transition-colors outline-none ${focused ? 'outline outline-[2px] outline-white bg-white/10 text-blue-400' : 'text-gray-400 hover:text-blue-400 hover:bg-white/10'}`} 
                  title="上传自定义皮肤"
                ><ImagePlus size={18} /></button>
              )}
            </FocusItem>
            
            <FocusItem focusKey={`btn-edit-${account.uuid}`} onEnter={() => onEdit(account)}>
              {({ ref, focused }) => (
                <button 
                  ref={ref as any} onClick={() => onEdit(account)} tabIndex={-1}
                  className={`p-2 rounded-lg transition-colors outline-none ${focused ? 'outline outline-[2px] outline-white bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} 
                  title="修改名称"
                ><Pencil size={18} /></button>
              )}
            </FocusItem>
          </>
        )}
        
        <FocusItem focusKey={`btn-del-${account.uuid}`} onEnter={() => onRemove(account.uuid)}>
          {({ ref, focused }) => (
            <button 
              ref={ref as any} onClick={() => onRemove(account.uuid)} tabIndex={-1}
              className={`p-2 rounded-lg transition-colors outline-none ${focused ? 'outline outline-[2px] outline-white bg-white/10 text-red-400' : 'text-gray-400 hover:text-red-400 hover:bg-white/10'}`} 
              title="移除账号"
            ><Trash2 size={18} /></button>
          )}
        </FocusItem>
      </div>

      <div className="w-full">
        {isActive ? (
          <div className="ore-account-active-tag">
            <CheckCircle2 size={16} className="mr-2 ore-active-check" /> 正在使用
          </div>
        ) : (
          <FocusItem focusKey={`btn-active-${account.uuid}`} onEnter={() => onSetCurrent(account.uuid)}>
            {({ ref, focused }) => (
              <button
                ref={ref as any}
                onClick={() => onSetCurrent(account.uuid)}
                tabIndex={-1}
                className={`ore-account-set-active-btn ${focused ? 'is-focused' : ''}`}
              >
                设为当前身份
              </button>
            )}
          </FocusItem>
        )}
      </div>
    </div>
  );
};