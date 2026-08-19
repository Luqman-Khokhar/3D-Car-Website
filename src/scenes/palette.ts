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

/**
 * The circuit. Asphalt rather than the white ribbon it used to be: white tarmac
 * on light grey ground had no material to it, and every marking laid on it had
 * to be a grey darker than the road, which is the opposite of how a track reads.
 * Dark surface, white paint, red/white kerbs — the marking colours are now the
 * bright ones, so they carry at the far end of the straight.
 *
 * Still deliberately a small set: two greys for the road, two for the paint, two
 * for the kerb. Everything else on the circuit is furniture (see trackProps).
 */
export const TRACK_SURFACE = '#4a4f57'
/** Chequer squares, and the shadow line under the kerb. Near-black, not black —
 *  same reason as NIGHT_AIR. */
export const TRACK_BORDER = '#2a2e34'
/** Lane dashes, edge lines and the light half of the start chequer. */
export const TRACK_LINE = '#f1f3f6'

/** Rumble strip. The one saturated colour on the driving surface, so the edge of
 *  the road is legible from the chase camera without a dark band to outline it. */
export const KERB_RED = '#c6382e'
export const KERB_WHITE = '#eceee9'

/**
 * Verge and infield. Two tones alternating per segment, which reads as mown
 * stripes rather than a flat green field — the same trick that stops the tarmac
 * from looking like a decal, applied to the ground it sits on.
 */
export const GRASS_DARK = '#3f6b39'
export const GRASS_LIGHT = '#4d7d43'

/** Track furniture. Hoardings cycle through the accents; the rest is structure. */
export const PROP_STEEL = '#ccd2d8'
export const PROP_TYRE = '#1c1f23'
export const PROP_TRUNK = '#4a3a2c'
export const PROP_LEAF = '#37633a'
export const PROP_LEAF_ALT = '#2e5533'
export const PROP_CONE = '#df6a1e'
export const PROP_SEAT = '#2f5fa0'
export const PROP_SEAT_ALT = '#b3392f'
export const PROP_LIGHT_OFF = '#3a1512'
export const PROP_LIGHT_ON = '#ff2a1c'
export const HOARDING_COLORS = ['#1f4e8c', '#c6382e', '#d9a021', '#2f7d5b', '#eceee9'] as const

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
