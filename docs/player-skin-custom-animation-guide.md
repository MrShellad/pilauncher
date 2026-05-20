# Player Skin Custom Animation Guide

This project uses the Modrinth player GLTF skeleton for the live skin preview. Custom animations should be authored as GLTF/GLB animation clips that target the same bone names as the bundled models.

## Runtime API

Use the singleton skin engine:

```ts
const engine = SkinEngine.current;
```

Register an existing `THREE.AnimationClip`:

```ts
engine?.registerAnimationClip('my_idle_variant', clip, {
  loop: 'once',
  randomIdle: true,
  weight: 1,
});
```

Import clips from a user-provided GLTF/GLB file:

```ts
const [file] = input.files ?? [];
if (file) {
  await engine?.importAnimationGltf(file, {
    clipName: 'wave_small',
    id: 'wave_small',
    loop: 'once',
    randomIdle: false,
  });
  engine?.playTransientAnimation('wave_small');
}
```

Import all clips from a URL:

```ts
const ids = await engine?.importAnimationGltf('/animations/player-emotes.glb', {
  loop: 'once',
});
engine?.playAnimation(ids?.[0] ?? 'idle');
```

## Supported Options

- `id`: Runtime animation id. Use this only when importing a single clip.
- `clipName`: Name of the clip inside the GLTF/GLB. Omit it to import all clips.
- `loop`: `once` for emotes and random idle variants, `repeat` for a replacement base loop.
- `randomIdle`: Adds the animation to the automatic idle variant pool.
- `weight`: Random idle selection weight. Defaults to `1`.

## Authoring Requirements

Use these source models as animation rigs:

- `src/assets/models/classic-player.gltf`
- `src/assets/models/slim-player.gltf`

Do not rename bones. The animation tracks must target the same node names:

- `Body`
- `Head`
- `Right_Arm`
- `Left_Arm`
- `Right_Leg`
- `Left_Leg`
- `Cape`

The bundled clips are good references:

- `idle`: base loop
- `idle_sub_1`, `idle_sub_2`, `idle_sub_3`: one-shot idle variants
- `interact`: click interaction

## Blender Workflow

1. Import `classic-player.gltf` or `slim-player.gltf`.
2. Animate the existing bones. Do not create a new skeleton unless the exported tracks still target the same node names.
3. Keep the model at the origin and avoid keyframing mesh materials or textures.
4. Put one motion per Action or NLA clip and give it a stable name, for example `wave_small`.
5. Export as GLB or GLTF with animations enabled.
6. Test with `engine.importAnimationGltf(file, { clipName: 'wave_small', id: 'wave_small' })`.

## Animation Behavior

- One-shot animations fade in over `0.2s`, play once, then return to `idle`.
- Repeating animations keep playing until another animation is requested.
- Dragging the preview rotates the model only.
- Clicking without dragging plays `interact` when available.

## Common Issues

- If an animation imports but the player does not move, the track target names likely do not match the bundled model nodes.
- If the preview faces backward, do not rotate the camera in the exported animation. The engine already applies the project front-facing correction.
- If a cape animation looks wrong, check that the clip targets `Cape` and not a renamed duplicate.
- If multiple clips are imported with the same id, the latest registration replaces the old one.
