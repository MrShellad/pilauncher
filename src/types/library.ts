// src/types/library.ts

export interface StarredItem {
  id: string;
  type: string; // "mod" | "modpack" | "server"
  source: string; // "modrinth" | "curseforge" | "custom"
  projectId?: string;
  title?: string;
  author?: string;
  snapshot: string; // JSON string payload
  state: string;    // JSON string payload
  meta: string;     // JSON string payload
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotPayload {
  title: string;
  iconUrl?: string;
  author?: string;
  description?: string;
  loaders?: string[];
  categories?: string[];
  version?: string;
  updatedAt?: string;
}

export interface StatePayload {
  installedVersion?: string;
  lastKnownVersion?: string;
  lastKnownUpdatedAt?: string;
  hasUpdate: boolean;
  lastCheckedAt?: number;
}

export interface MetaPayload {
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  note?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  type: string; // "group" | "modpack" | "favorite"
  coverImage?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  itemId: string;
  position: number;
  extra?: string; // JSON string payload
  createdAt: number;
}

export interface CollectionItemExtra {
  lockedVersion?: string;
  required?: boolean;
}
