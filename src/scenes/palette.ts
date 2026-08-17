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
 * Outside the sectional door. The circuit itself is white, so the ground it sits
 * on cannot be — a white track on white ground is invisible. This is the lightest
 * grey that still lets the tarmac read as a separate surface.
 */
export const OUTSIDE_GROUND = '#c5ccd4'

/** Air outside: background and fog once the car is out. A shade lighter than the
 *  ground so the far end of the circuit dissolves upward into haze rather than
 *  ending on a horizon line. */
export const OUTSIDE_AIR = '#e9edf1'

/** Fog range outside. Far has to clear the whole circuit (~80 m from the door) or
 *  the back straight fades out while the car is still driving toward it. */
export const OUTSIDE_FOG_NEAR = 50
export const OUTSIDE_FOG_FAR = 185

/** Racing surface, its kerbs, and the broken lane line. Only three values on
 *  purpose: the track is a white ribbon with a dark edge, not a painted circuit. */
export const TRACK_SURFACE = '#ffffff'
export const TRACK_BORDER = '#3a4048'
export const TRACK_LINE = '#c2c8d0'

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
