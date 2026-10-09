export interface KeyBind {
  name: string;
  key: string;
}

export interface KeyboardProfile {
  name: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  version: string;
  keybindings: KeyBind[];
}

export interface KeyboardProfileListItem {
  filename: string;
  profile: KeyboardProfile;
}

export interface KeyboardLocData {
  metadata: {
    authors: string[];
    createdAt: string;
    updatedAt: string;
    version: string;
  };
  keys: Record<string, string>;
  actions: Record<string, string>;
}

export interface KeycapData {
  index: number;
  outer: { x: number; y: number; w: number; h: number; rx: number };
  inner: { x: number; y: number; w: number; h: number; rx: number };
  label: string;
  keyCode: string;
}

export type SortField = 'name' | 'key' | 'status';
export type SortOrder = 'asc' | 'desc';
