// src/features/Settings/components/tabs/AS/AccountCard.tsx
import React, { useEffect, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { CheckCircle2, ImagePlus, Pencil, ShieldCheck, Trash2, UserRound } from 'lucide-react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
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
  account,
  isActive,
  onSetCurrent,
  onRemove,
  onEdit,
  onUploadSkin
}) => {
  const rawType = account.type || (account as any).account_type || (account as any).accountType || '';
  const isMS = rawType.toLowerCase() === 'microsoft';
  const displayName = account.name || (account as any).username || '未知玩家';
  const rawUuid = account.uuid || (account as any).id || '';
  const isValidUuid = rawUuid.length >= 32;
  const displayUuid = rawUuid || '8667ba71-b85a-4004-af54-457a9734eed7';
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackendAvatar = async () => {
      try {
        const validId = isValidUuid ? rawUuid : '8667ba71b85a4004af54457a9734eed7';
        const localPath = await invoke<string>('get_or_fetch_account_avatar', {
          uuid: validId,
          username: account.name
        });
        const cacheBuster = account.skinUrl?.split('?t=')[1] || 'init';
        setAvatarSrc(`${convertFileSrc(localPath)}?t=${cacheBuster}`);
      } catch (error) {
        console.error('[AccountCard] avatar fetch failed:', error);
        setAvatarSrc(defaultAvatar);
      }
    };

    fetchBackendAvatar();
  }, [rawUuid, isValidUuid, account.name, account.skinUrl]);

  const renderAvatar = () => {
    if (!isMS && account.skinUrl) {
      const basePath = account.skinUrl.split('?')[0];
      const ts = account.skinUrl.split('?')[1];
      const src = convertFileSrc(basePath) + (ts ? `?${ts}` : '');
      return (
        <div className="relative h-full w-full overflow-hidden rendering-pixelated">
          <img
            src={src}
            className="absolute max-w-none"
            alt="Skin"
            style={{ width: '800%', height: '800%', left: '-100%', top: '-100%' }}
          />
        </div>
      );
    }

    return (
      <img
        src={avatarSrc || defaultAvatar}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = defaultAvatar;
        }}
        alt="Avatar"
        className={`h-full w-full object-cover rendering-pixelated transition-opacity duration-300 ${avatarSrc ? 'opacity-100' : 'opacity-40'}`}
      />
    );
  };

  const renderIconButton = (
    focusKey: string,
    title: string,
    icon: React.ReactNode,
    tone: 'neutral' | 'accent' | 'danger',
    onPress: () => void
  ) => (
    <FocusItem focusKey={focusKey} onEnter={onPress}>
      {({ ref, focused }) => (
        <button
          ref={ref as any}
          onClick={onPress}
          tabIndex={-1}
          title={title}
          className={`ore-account-icon-btn ${tone} ${focused ? 'is-focused' : ''}`}
        >
          {icon}
        </button>
      )}
    </FocusItem>
  );

  return (
    <div className={`ore-account-card ${isMS ? 'is-premium' : 'is-offline'} ${isActive ? 'is-active' : ''}`}>
      <div className="ore-account-head">
        <div className="ore-account-tags">
          <span className={`ore-account-type-tag ${isMS ? 'is-premium' : 'is-offline'}`}>
            {isMS ? '正版账号' : '离线账号'}
          </span>
          <span className={`ore-account-status-tag ${isActive ? 'is-active' : ''}`}>
            {isActive ? '当前使用' : '可切换'}
          </span>
        </div>
      </div>

      <div className="ore-account-hero">
        <div className="ore-card-avatar-wrapper">
          <div className="ore-card-avatar-inner">
            {renderAvatar()}
          </div>
          <div className={`ore-account-avatar-emblem ${isMS ? 'is-premium' : 'is-offline'}`}>
            {isMS ? <ShieldCheck size={14} /> : <UserRound size={14} />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="ore-account-name">{displayName}</div>
          <div className="ore-account-subtitle" title={displayUuid}>
            {isMS ? 'Minecraft Java Edition' : `Offline UUID: ${displayUuid}`}
          </div>
          <div className="ore-account-note">
            {isMS ? '身份信息与头像将自动同步。' : '当前为离线账户'}
          </div>
        </div>
      </div>

      <div className="ore-account-divider" />

      <div className="ore-account-toolbar">
        {!isMS && (
          <>
            {renderIconButton(
              `btn-skin-${account.uuid}`,
              '上传自定义皮肤',
              <ImagePlus size={18} />,
              'accent',
              () => onUploadSkin(account.uuid)
            )}
            {renderIconButton(
              `btn-edit-${account.uuid}`,
              '修改名称',
              <Pencil size={18} />,
              'neutral',
              () => onEdit(account)
            )}
          </>
        )}

        {renderIconButton(
          `btn-del-${account.uuid}`,
          '移除账号',
          <Trash2 size={18} />,
          'danger',
          () => onRemove(account.uuid)
        )}
      </div>

      <div className="mt-auto w-full">
        {isActive ? (
          <div className="ore-account-active-tag">
            <CheckCircle2 size={16} className="ore-active-check mr-2" />
            正在使用
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
