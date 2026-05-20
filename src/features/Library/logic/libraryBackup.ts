export interface LibraryImportOptions {
  mergeSameNameTags: boolean;
}

export interface LibraryImportPreview {
  schemaVersion: number;
  starredItems: number;
  newStarredItems: number;
  duplicateStarredItems: number;
  collections: number;
  newCollections: number;
  mergedTagCollections: number;
  collectionItems: number;
  newCollectionItems: number;
  duplicateCollectionItems: number;
  modSetTrackers: number;
  importableModSetTrackers: number;
  warnings: string[];
}

export interface LibraryImportResult {
  importedStarredItems: number;
  skippedStarredItems: number;
  importedCollections: number;
  mergedTagCollections: number;
  importedCollectionItems: number;
  skippedCollectionItems: number;
  importedModSetTrackers: number;
  warnings: string[];
}

export interface LibraryImportDraft {
  path: string;
  options: LibraryImportOptions;
  preview: LibraryImportPreview;
}
