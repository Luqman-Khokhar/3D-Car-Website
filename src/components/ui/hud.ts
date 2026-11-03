/**
 * Shared HUD styling. The three top-right controls each carried their own copy
 * of the same pill classes and had drifted apart — different heights, paddings
 * and hover rules — so the stack read as three widgets rather than one panel.
 */

/** Base pill: dark glass on the scene, mono caps. Height is fixed so a select
 *  and a button line up exactly. */
export const HUD_PILL =
  'flex h-9 items-center gap-2.5 rounded-full border px-4 font-mono text-[0.65rem] tracking-[0.18em] uppercase backdrop-blur-sm transition-[color,background-color,border-color,opacity,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none md:text-xs'

/** Resting state of an interactive pill. */
export const HUD_PILL_IDLE =
  'border-stone-300/50 bg-black/35 text-stone-200 hover:border-stone-100 hover:text-stone-50'

/** Pressed feedback; a 2% dip reads as a physical press without moving layout. */
export const HUD_PRESS = 'active:scale-[0.98] disabled:active:scale-100'

/** Passive panel (legend, swatch tray) — same glass, no interaction states. */
export const HUD_PANEL = 'rounded-full border border-stone-300/30 bg-black/40 backdrop-blur-sm'
