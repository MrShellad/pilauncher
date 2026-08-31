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
  capeUrl: rawAccount.cape_url || rawAccount.capeUrl || fallback.capeUrl || null,
  metadata: rawAccount.metadata || fallback.metadata || null,
});

export const validateSkinImage = (previewUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      const isValidMinecraftSkin = width === 64 && (height === 64 || height === 32);

      if (isValidMinecraftSkin) {
        resolve({ width, height });
        return;
      }

      reject(new Error(`皮肤尺寸不受支持，当前是 ${width}x${height}。仅支持 Minecraft 标准 64x64 或旧版 64x32 PNG。`));
    };
    image.onerror = () => reject(new Error('无法读取 PNG 图片，请确认文件未损坏。'));
    image.src = previewUrl;
  });

/**
 * 精准检测 Minecraft 皮肤贴图是 Slim (3px, Alex) 还是 Classic (4px, Steve)
 * 基于 Minecraft 64x64 规范：
 * - 64x32 传统旧版皮肤一律为 Classic
 * - 64x64 现代皮肤：检测右臂/左臂对应区域的第 4 像素列（54..55, 20..31 以及 50..51, 16..19）
 * - 若这些像素全部为 0 (完全透明)，则为 Slim 纤细手臂模型；若包含任何非透明像素，则为 Classic 经典手臂模型。
 */
export const determineModelType = async (textureUrl: string): Promise<WardrobeSkinModel> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      resolve('classic');
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = textureUrl;

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      // 64x32 旧版皮肤统一为 Classic
      if (image.height === 32) {
        canvas.remove();
        resolve('classic');
        return;
      }

      context.drawImage(image, 0, 0);

      // 1. 检测右臂内层第 4 像素列 (x: 54..55, y: 20..31)
      const armX = 54;
      const armY = 20;
      const armWidth = 2;
      const armHeight = 12;
      const imageData = context.getImageData(armX, armY, armWidth, armHeight).data;
      for (let alphaIndex = 3; alphaIndex < imageData.length; alphaIndex += 4) {
        if (imageData[alphaIndex] !== 0) {
          canvas.remove();
          resolve('classic');
          return;
        }
      }

      // 2. 检测右臂底面 (x: 50..51, y: 16..19)
      const bottomData = context.getImageData(50, 16, 2, 4).data;
      for (let alphaIndex = 3; alphaIndex < bottomData.length; alphaIndex += 4) {
        if (bottomData[alphaIndex] !== 0) {
          canvas.remove();
          resolve('classic');
          return;
        }
      }

      // 3. 检测左臂对应区域 (x: 42..43, y: 52..63)
      const leftArmData = context.getImageData(42, 52, 2, 12).data;
      for (let alphaIndex = 3; alphaIndex < leftArmData.length; alphaIndex += 4) {
        if (leftArmData[alphaIndex] !== 0) {
          canvas.remove();
          resolve('classic');
          return;
        }
      }

      canvas.remove();
      resolve('slim');
    };

    image.onerror = () => {
      canvas.remove();
      resolve('classic');
    };
  });
};

export const accountSkinPreviewUrl = (account: MinecraftAccount | null): string | null => {
  const rawUrl = account?.skinUrl;
  if (!rawUrl) return null;

  const [base, query] = rawUrl.split('?');
  if (/^(https?:|asset:|data:|blob:)/.test(base)) return rawUrl;
  return `${convertFileSrc(base)}${query ? `?${query}` : ''}`;
};

export const toStoredAssetUrl = (asset: WardrobeStoredSkinAsset): string =>
  `${convertFileSrc(asset.filePath)}?t=${asset.createdAt}`;
