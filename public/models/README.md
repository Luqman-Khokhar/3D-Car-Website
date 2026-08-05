# Model pipeline

The scene currently runs on a procedural rig (`src/components/3d/ProceduralCar.tsx`)
built from Three.js primitives. Dropping in a real model does not touch any
timeline code, provided the model honours the contract below.

## Contract

Timelines look parts up by name through `src/animations/partRegistry.ts`. A model
is compatible when it satisfies all of these:

| Requirement | Value |
|---|---|
| Format | `.glb`, Draco-compressed |
| Total size | under 8 MB |
| Up axis | Y-up |
| Origin | car centre, ground plane at `y = 0` |
| Front | `+Z` |
| Scale | real world metres (~4.3 m long, ~1.85 m wide) |

### Required node names

Each must be a single node (mesh or group) — the timelines tween the node, so a
part split across siblings will animate apart:

```
chassis            engine_block       body_shell         roof
door_L             door_R             hood               trunk
bumper_F           bumper_R           lamps_rear         lamps_front
interior_seats     windshield         wheel_FL           wheel_FR
wheel_RL           wheel_RR
```

`lamps_rear` and `lamps_front` are the lit elements only — lenses, bowls and the
daytime strip. Their dark housings belong to `body_shell`, because the two
lighting scenes fly the lamps into a nose and tail that are already there.

The canonical list lives in `src/scenes/carParts.ts` (`CAR_PARTS[].id`). Extra
nodes are ignored; missing ones make `requirePart()` throw by design, so a typo
fails loudly instead of silently skipping an animation.

## Optimizing a model you were handed

Inspect first — check node names and current size:

```bash
npx --yes @gltf-transform/cli inspect raw-car.glb
```

Then run the optimize pass. `--compress draco` is what the runtime expects, and
the texture resize keeps a 4K-textured download under budget:

```bash
npx --yes @gltf-transform/cli optimize raw-car.glb public/models/car.glb \
  --compress draco \
  --texture-compress webp \
  --texture-size 2048 \
  --simplify false
```

`--simplify false` matters: the simplifier welds vertices across node boundaries
and can merge two parts into one mesh, which breaks the per-part animation. Only
enable it after confirming the node names survive.

Verify the result:

```bash
npx --yes @gltf-transform/cli inspect public/models/car.glb
```

If a source model arrives as `.fbx`, convert with Blender first (import FBX,
export glTF 2.0, "+Y Up" enabled), then run the optimize pass above.

## Wiring it up

1. Put the optimized file at `public/models/car.glb`.
2. Replace the body of `src/components/3d/CarModel.tsx` — the required code is in
   that file's doc comment.
3. Draco decoder files are already self-hosted in `public/draco/` (no CDN), so
   load with `useGLTF(url, '/draco/')`.

The decoder is copied out of the `three` package. After upgrading `three`, re-sync it:

```bash
npm run sync:draco
```

## Generating typed JSX from a GLB

Useful when you want explicit per-mesh components instead of `<primitive>`:

```bash
npx --yes gltfjsx@latest public/models/car.glb --types --keepnames --shadows
```

`--keepnames` is required — without it the node names the registry depends on are
mangled.
