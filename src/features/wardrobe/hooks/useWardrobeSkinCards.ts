import { useMemo } from 'react';

import type { SkinCardAsset, WardrobeSkinModel, WardrobeStoredSkinAsset } from '../types';
import { modelLabel, resolveSkinModel, toStoredAssetUrl } from '../utils/wardrobe.utils';

export function useWardrobeSkinCards(
  assets: WardrobeStoredSkinAsset[] | undefined,
  fallbackModel: WardrobeSkinModel,
  skinNotes: Record<string, string>
) {
  return useMemo<SkinCardAsset[]>(
    () =>
      (assets ?? []).map((asset) => {
        const variant = resolveSkinModel(asset.variant ?? fallbackModel);
        const originalTitle = asset.fileName.replace(/\.png$/i, '');
        const note = (skinNotes[asset.id] ?? asset.note ?? '').trim();
        return {
          id: asset.id,
          kind: 'library' as const,
          title: note || originalTitle,
          originalTitle,
          note: note || undefined,
          subtitle: modelLabel(variant),
          skinUrl: toStoredAssetUrl(asset),
          variant,
          filePath: asset.filePath,
          isActive: asset.isActive,
          canDelete: !asset.isActive,
        };
      }).sort((left, right) =>
        left.isActive === right.isActive ? 0 : left.isActive ? -1 : 1
      ),
    [assets, fallbackModel, skinNotes]
  );
}
