export type WardrobeTab = 'skin' | 'cape';
export type WardrobeSkinModel = 'classic' | 'slim';

export interface WardrobeSkin {
  id?: string | null;
  state?: string | null;
  url: string;
  variant?: string | null;
}

export interface WardrobeCape {
  id: string;
  url: string;
  alias?: string | null;
  state?: string | null;
}

export interface WardrobeProfile {
  id: string;
  name: string;
  skins: WardrobeSkin[];
  capes: WardrobeCape[];
}

export interface WardrobeStoredSkinAsset {
  id: string;
  fileName: string;
  filePath: string;
  variant?: string | null;
  note?: string | null;
  contentHash: string;
  createdAt: number;
  isActive: boolean;
}

export interface WardrobeSkinLibrary {
  activeHash?: string | null;
  assets: WardrobeStoredSkinAsset[];
}

export interface SkinCardAsset {
  id: string;
  kind: 'profile' | 'library';
  title: string;
  originalTitle?: string;
  note?: string;
  subtitle: string;
  skinUrl: string;
  variant: WardrobeSkinModel;
  filePath?: string;
  isActive: boolean;
  canDelete: boolean;
}
