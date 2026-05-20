# Player Skin Optimization Plan

Based on `docs/player-skin-technical-analysis.md`, this plan adapts the Modrinth skin workflow to the current React + Tauri implementation.

## Checklist

- [x] Backend: add authoritative PNG signature/IHDR validation for wardrobe skins, active skin cache, and Mojang upload input.
- [x] Backend: close the local wardrobe loop so saving, applying, deleting, and offline activation keep metadata and runtime `skin.png` consistent.
- [x] Frontend engine: replace the fixed timer render loop with visibility-aware `requestAnimationFrame` scheduling, interaction boosts, and safer pause/resume behavior.
- [x] Frontend animation: add transient interaction animations and keep random idle scheduling under engine control.
- [x] Frontend animation: remove the earlier approximated keyframe idle in favor of the real Modrinth GLTF animation clips.
- [x] Frontend animation: remove the old `skinview3d` wave animation from registration, random idle, and preview triggers.
- [x] Frontend rendering: switch the live preview engine to Modrinth GLTF player models with Three.js textures, lighting, and radial floor shadow.
- [x] Frontend animation: drive live preview with GLTF `AnimationMixer` clips (`idle`, `idle_sub_*`, `interact`) and fade transitions.
- [x] Frontend rendering: correct the default camera/model facing direction so the live preview opens on the player front.
- [x] Frontend rendering: pull the GLTF preview camera back and keep a fixed front-facing target so the model no longer clips into the camera.
- [x] Frontend rendering: tune GLTF preview scale and camera distance so the player fills the wardrobe preview without clipping.
- [x] Frontend rendering: tune wardrobe skin cards to upper-body previews instead of full-body thumbnails.
- [x] Frontend rendering: enlarge cape card thumbnails so the cape is visible in-card.
- [x] Frontend rendering: re-center the wardrobe right-side live preview with fixed target/camera framing.
- [x] Frontend rendering: align cape card previews with the currently selected skin texture/model instead of Steve.
- [x] Frontend rendering: re-balance live preview vertical framing and increase skin-card thumbnail zoom.
- [x] Frontend rendering: re-center wardrobe card thumbnails and reduce skin/cape card zoom to avoid clipped previews.
- [x] Frontend rendering: correct slim-model skin card vertical framing and invalidate old thumbnail cache keys.
- [x] Frontend rendering: keep classic/slim skin card framing consistent after model switches and clear stale preview frames.
- [x] Frontend rendering: match skin card thumbnail camera, model transform, and lighting to Modrinth batch preview generation.
- [x] Frontend rendering: improve thumbnail edge quality with higher-resolution offscreen renders and normal image scaling.
- [x] Frontend rendering: brighten the skin edit modal preview background and enlarge its full-body render.
- [x] UI: replace wardrobe bottom status messages with global toast notifications.
- [x] Frontend interaction: prevent wardrobe gamepad recentering from overriding mouse/touch drag rotation.
- [x] Frontend animation: expose custom GLTF/GLB animation import and clip registration APIs for user-made animations.
- [x] Documentation: add `docs/player-skin-custom-animation-guide.md` for custom animation authoring and runtime import.
- [x] Thumbnail pipeline: render wardrobe card previews from the same Modrinth GLTF models for front/back consistency.
- [x] Thumbnail pipeline: improve cache keys, avoid duplicate in-flight renders, output compressed WebP previews, and generate front/back skin thumbnails.
- [x] UI: use cached front/back previews for skin-card flip animation and keep loading states stable.
- [x] Verification: run type/build checks and record any remaining risk.

## Verification

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri\Cargo.toml` passed.
