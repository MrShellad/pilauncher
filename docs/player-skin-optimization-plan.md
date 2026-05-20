# Player Skin Optimization Plan

Based on `docs/player-skin-technical-analysis.md`, this plan adapts the Modrinth skin workflow to the current React + Tauri + skinview3d implementation.

## Checklist

- [x] Backend: add authoritative PNG signature/IHDR validation for wardrobe skins, active skin cache, and Mojang upload input.
- [x] Backend: close the local wardrobe loop so saving, applying, deleting, and offline activation keep metadata and runtime `skin.png` consistent.
- [x] Frontend engine: replace the fixed timer render loop with visibility-aware `requestAnimationFrame` scheduling, interaction boosts, and safer pause/resume behavior.
- [x] Frontend animation: add transient interaction animations and keep random idle scheduling under engine control.
- [x] Thumbnail pipeline: improve cache keys, avoid duplicate in-flight renders, output compressed WebP previews, and generate front/back skin thumbnails.
- [x] UI: use cached front/back previews for skin-card flip animation and keep loading states stable.
- [x] Verification: run type/build checks and record any remaining risk.

## Verification

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri\Cargo.toml` passed.
