/**
 * Single source of truth for scene colour.
 *
 * The CSS custom properties in src/index.css mirror these values — if you change
 * one, change the other. Kept as literals rather than read from CSS because
 * three.js needs them before first paint, and reading computed styles on the
 * critical path costs a layout flush.
 */

/** Lit concrete wall / ambient air of the garage. Also the DOM page background. */
export const GARAGE_WALL = '#ddd8cf'

/**
 * Epoxy floor. Deliberately a cool slate rather than a darker version of the
 * wall: same-hue-darker reads as a shadow, a hue shift reads as a material.
 */
export const GARAGE_FLOOR = '#3c454f'

/** Distance fog. Matches the wall so the floor dissolves instead of ending on a
 *  hard horizon edge. Near is past the widest camera radius (10.5) so the car
 *  itself is never fogged. */
export const FOG_NEAR = 16
export const FOG_FAR = 44

/**
 * What the background and the fog become at full blackout in the head-lamps
 * scene. Deliberately a cold near-black rather than #000: a true black background
 * has no hue for the tone map to work with, so the unlit half of the car lands on
 * it as a flat cut-out with no edge at all.
 */
export const NIGHT_AIR = '#080a0e'

/**
 * Body colour. PRIMER is where the paint scene starts and BODY is where it lands;
 * src/hooks/usePaintPass.ts lerps between them off the scrubbed timeline, so the
 * panels fly in bare and are painted in scene 05.
 */
export const PRIMER = '#6b6f75'
export const BODY = '#8d2b32'

/**
 * Picker options for the paint scene. Curated rather than a free hex input:
 * PAINTED_SURFACE's metalness/roughness/clearcoat curve in usePaintPass.ts was
 * tuned against BODY specifically, and an arbitrary colour under that same
 * clearcoat can read flat or blown out. `rosso` is BODY itself, kept first so
 * the default selection matches the untouched scene.
 */
export const BODY_SWATCHES = [
  { name: 'Rosso', hex: BODY },
  { name: 'Nero', hex: '#1c1e22' },
  { name: 'Bianco', hex: '#e8e6df' },
  { name: 'Blu', hex: '#1f3a5f' },
  { name: 'Giallo', hex: '#c9962b' },
] as const
