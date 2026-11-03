# Assembly

A scroll-driven WebGL story: a sports car builds itself in a garage, part by part, as you scroll — chassis, V8, body panels, lamps, paint, cabin, wheels. Then it is yours: orbit the bay in 360° view, open the door and drive it round the circuit outside, or stand it up as a robot.

React 19 · TypeScript · Vite · three.js / React Three Fiber · GSAP ScrollTrigger · Lenis · Zustand · Tailwind 4

## Scripts

```bash
npm run dev            # dev server
npm run build          # typecheck + production build
npm run preview        # serve the build
npm run lint           # oxlint
npm run sync:draco     # re-copy the Draco decoder after upgrading three
```

## URL flags

| Flag | Effect |
|---|---|
| `?quality=high\|medium\|low` | Force a render tier and skip calibration |
| `?lowpower` | Alias for `?quality=low` |
| `?debug` | Publish `window.__carScene` (scene, renderer, live state, store) for console and automated checks |

## How it runs

**Scroll story.** One GSAP timeline, scrubbed by ScrollTrigger over eleven 100vh spacers, tweens plain state objects (`cameraState`, `lightingState`, `paintState`) and the car's part groups. Frame callbacks read those objects directly, so scrolling never re-renders React. Copy is a fixed, cross-fading overlay; the chapter rail on the right jumps to any scene.

**Render tiers** (`src/lib/quality.ts`). The starting tier comes from the GPU string, not the CPU core count:

| Tier | Typical hardware | Post chain | N8AO | Area lights | Shadows | Contact shadow | Floor |
|---|---|---|---|---|---|---|---|
| high | discrete GPU, Apple silicon | ✓ | ✓ | ✓ | ✓ | 512 | PBR |
| medium | integrated laptop GPU | ✓ | – | – | ✓ | 256 | PBR |
| low | phones, software GL | – | – | – | – | – | Lambert |

`AdaptiveQuality` then measures real frames behind the loading screen, on the finished car with both shadow passes redrawing, and lowers the resolution or the tier until it holds ~42 fps. The result is cached per GPU, so later visits skip it. After the reveal a light governor keeps adjusting the device pixel ratio from frames drawn back to back.

**On-demand rendering.** The canvas runs `frameloop="demand"`. `RenderDriver` requests frames when the scrubbed timeline moves, while the robot transforms, and on any store change; components that ease (camera return, door, light fades, driving) request their own until they land. A parked camera draws nothing. Shadow maps and the contact shadow redraw only when the car has actually moved.

**Code splitting.** The entry chunk is React plus the DOM layer only, so the loader paints first (index.html also carries a static copy of it). three, R3F and the scroll rig load next; the post chain (`PostFX`) and the area-light LTC tables (`CeilingStrips`) are separate chunks fetched only by tiers that use them.

Measured on an Intel UHD 620 at 1440×900, against the previous build: scrolling 15–19 fps → 36–38 fps, idle redraws ~18/s → ~1/s (the wall clock's second hand), low-tier download 647 → ~390 kB gzip, mid-scroll shader-compile hitches gone (everything is precompiled behind the loader).

## Controls

Scroll to build. **360° View** for free look: drag to orbit, scroll or pinch to zoom, arrows/WASD (or the on-screen pad on touch devices) to drive, click the red button by the door to open it, and the wall switches to throw the ceiling lights. **Transform** folds the car into a robot and back. Esc leaves free look.

## Swapping in a real model

The car is procedural (`src/components/3d/ProceduralCar.tsx`). A GLB that follows the naming and scale contract in [`public/models/README.md`](public/models/README.md) drops in through `src/components/3d/CarModel.tsx` without touching any timeline.
