# Mods Directory Reorganization Plan

## Scope

Target directory:

`src/features/InstanceDetail/components/tabs/mods`

This change only reorganizes files by responsibility and updates imports. It should not change component behavior, public props, focus keys, state shape, or UI copy.

## Current Problems

- Root-level files mix panel composition, mod list rendering, row rendering, download search UI, hooks, dialog state, and shared list helpers.
- Existing `components/` and `hooks/` folders are only partially used.
- Related files are separated, for example list row files live at the root while list subcomponents live under `components/`.

## Target Layout

```text
mods/
  components/
    dialogs/
    download/
    list/
    panel/
  hooks/
  modListShared.ts
```

## File Move Map

### Panel Shell

Move panel-level view components to `components/panel/`:

- `ModPanelTopBar.tsx` -> `components/panel/ModPanelTopBar.tsx`

### Dialogs

Move modal/dialog components to `components/dialogs/`:

- `ModPanelDialogs.tsx` -> `components/dialogs/ModPanelDialogs.tsx`
- `ModDetailModal.tsx` -> `components/dialogs/ModDetailModal.tsx`

### Installed Mod List

Move installed mod list components to `components/list/`:

- `ModList.tsx` -> `components/list/ModList.tsx`
- `ModAccordionVirtualList.tsx` -> `components/list/ModAccordionVirtualList.tsx`
- `ModListEmptyState.tsx` -> `components/list/ModListEmptyState.tsx`
- `ModListGridHeader.tsx` -> `components/list/ModListGridHeader.tsx`
- `ModListGroupHeader.tsx` -> `components/list/ModListGroupHeader.tsx`
- `ModListHeader.tsx` -> `components/list/ModListHeader.tsx`
- `ModListOverlay.tsx` -> `components/list/ModListOverlay.tsx`
- `ModRowActionCluster.tsx` -> `components/list/ModRowActionCluster.tsx`
- `ModRowItem.tsx` -> `components/list/ModRowItem.tsx`
- `ModRowView.tsx` -> `components/list/ModRowView.tsx`

Keep list types and helpers at the feature root for now:

- `modListShared.ts` stays in `mods/`

### Download Search View

Move instance resource download UI to `components/download/`:

- `InstanceModDownloadView.tsx` -> `components/download/InstanceModDownloadView.tsx`
- `InstanceFilterBar.tsx` -> `components/download/InstanceFilterBar.tsx`
- `ResourceGrid.tsx` -> `components/download/ResourceGrid.tsx`

### Hooks and Stores

Move root-level hooks and lightweight local stores to `hooks/`:

- `useIncrementalList.ts` -> `hooks/useIncrementalList.ts`
- `useInstanceDownloadSelectionStore.ts` -> `hooks/useInstanceDownloadSelectionStore.ts`
- `useModIconSubscription.ts` -> `hooks/useModIconSubscription.ts`
- `useModListController.ts` -> `hooks/useModListController.ts`
- `useModListFocus.ts` -> `hooks/useModListFocus.ts`
- `useModPanelController.ts` -> `hooks/useModPanelController.ts`
- `useModPanelDialogs.ts` -> `hooks/useModPanelDialogs.ts`
- `useModPanelFocusNavigation.ts` -> `hooks/useModPanelFocusNavigation.ts`
- `hooks/useModListData.ts` remains in `hooks/`

## Import Update Strategy

1. Update `ModPanel.tsx` external imports to the new panel/list/dialog/hook paths.
2. Update moved component imports according to their new folder depth.
3. Keep intra-list imports local within `components/list/` where possible.
4. Keep download view imports local within `components/download/` where possible.
5. Update hook imports to reference `../modListShared` and sibling hooks under `hooks/`.
6. Run a repository search for old root paths such as `./mods/ModList`, `./mods/ModPanelDialogs`, and `./mods/useModPanelController`.

## Safety Checks

- Use `git status --short` before and after to verify the change set.
- Run `npm.cmd run build` after import updates.
- Run `rg` checks for stale import paths under `src/features/InstanceDetail/components/tabs`.
- Do not delete unrelated files or revert unrelated changes.

