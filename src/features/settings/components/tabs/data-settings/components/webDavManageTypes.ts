export type WebDavManageTab = 'saves' | 'skins' | 'favorites' | 'keymaps';

export interface InstanceOption {
  id: string;
  name: string;
  version?: string;
  loader?: string;
}

export type DownloadMode = 'local' | 'restore';

export interface KeyboardProfile {
  name: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  version: string;
}

export interface KeyboardProfileListItem {
  filename: string;
  profile: KeyboardProfile;
}

export interface StarredItem {
  id: string;
  title?: string;
  author?: string;
  type: string;
  source: string;
}

export type WebDavArrowHandler = (direction: string) => boolean | void;
