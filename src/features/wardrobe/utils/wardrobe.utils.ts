import { convertFileSrc } from '@tauri-apps/api/core';
import type { MinecraftAccount } from '../../../store/useAccountStore';
import type {
  WardrobeProfile,
  WardrobeSkinModel,
  WardrobeStoredSkinAsset,
} from '../types';

export const isMicrosoftAccount = (account: MinecraftAccount | null | undefined): boolean =>
  account?.type?.toLowerCase() === 'microsoft';

export const resolveSkinModel = (variant?: string | null): WardrobeSkinModel =>
  variant?.toLowerCase() === 'slim' ? 'slim' : 'classic';

export const findActiveSkin = (profile: WardrobeProfile | null) =>
  profile?.skins.find((skin) => skin.state === 'ACTIVE') ?? profile?.skins[0] ?? null;

export const findActiveCape = (profile: WardrobeProfile | null) =>
  profile?.capes.find((cape) => cape.state === 'ACTIVE') ?? null;

export const isSessionExpiredError = (error: unknown): boolean => {
  const message = String(error);
  return message.includes('HTTP 401') || message.includes('会话已过期');
};

export const modelLabel = (model: WardrobeSkinModel): string => 
  model === 'slim' ? 'Slim 模型' : 'Classic 模型';

export const toAccountData = (rawAccount: Record<string, any>, fallback: MinecraftAccount): MinecraftAccount => ({
  uuid: rawAccount.uuid || rawAccount.id || rawAccount.profileId || fallback.uuid,
  name: rawAccount.username || rawAccount.name || rawAccount.displayName || fallback.name,
  type: 'microsoft',
  accessToken: rawAccount.access_token || rawAccount.accessToken || fallback.accessToken,
  refreshToken: rawAccount.refresh_token || rawAccount.refreshToken || fallback.refreshToken || null,
  expiresAt: rawAccount.expires_at || rawAccount.expiresAt || fallback.expiresAt || null,
  skinUrl: rawAccount.skin_url || rawAccount.skinUrl || fallback.skinUrl || null,
});

export const validateSkinImage = (previewUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      // Allow standard (64) and HD (multiples of 64)
      const isMultipleOf64 = width > 0 && width % 64 === 0;
      const isValidAspectRatio = height === width || height === width / 2;

      if (isMultipleOf64 && isValidAspectRatio) {
        resolve({ width, height });
        return;
      }
      reject(new Error(`皮肤尺寸不支持，当前是 ${width}x${height}。支持 64x64, 64x32 及其高清倍率。`));
    };
    image.onerror = () => reject(new Error('无法读取 PNG 图片，请确认文件未损坏'));
    image.src = previewUrl;
  });

export const accountSkinPreviewUrl = (account: MinecraftAccount | null): string | null => {
  const rawUrl = account?.skinUrl;
  if (!rawUrl) return null;

  const [base, query] = rawUrl.split('?');
  if (/^(https?:|asset:|data:|blob:)/.test(base)) return rawUrl;
  return `${convertFileSrc(base)}${query ? `?${query}` : ''}`;
};

export const toStoredAssetUrl = (asset: WardrobeStoredSkinAsset): string =>
  `${convertFileSrc(asset.filePath)}?t=${asset.createdAt}`;
