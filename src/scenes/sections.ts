import type { SectionId } from '@/store/useSceneStore'

/** Scroll container the master ScrollTrigger measures. */
export const SCROLL_ROOT_ID = 'scroll-root'

export interface SectionCopy {
  id: SectionId
  /** Small overline label. */
  label: string
  title: string
  body: string
  /** Hero only: sits under the title, above the scroll cue. */
  subtitle?: string
}

/**
 * Narrative copy for the nine scenes.
 *
 * Rule for editing: describe only what is actually on screen at that scroll
 * offset. Copy that promises an effect the scene does not perform reads as a
 * bug — the earlier draft mentioned steel coils and a paint reveal that were
 * never built, and both landed as missing visuals rather than as writing.
 */
export const SECTION_COPY: SectionCopy[] = [
  {
    id: 'hero',
    label: '00 / The Bay',
    title: 'Assembly',
    subtitle: 'A sports car, built from nothing, one part at a time.',
    body: 'An empty bay. A lit tool wall, a bench, and a painted outline on the floor. Everything after this is addition.',
  },
  {
    id: 'raw-materials',
    label: '01 / Footprint',
    title: 'Nothing But Paint',
    body: 'Four and a quarter metres of outline on a concrete floor. Every part that follows has to land inside it, to the millimetre.',
  },
  {
    id: 'chassis',
    label: '02 / Chassis & Frame',
    title: 'The Spine',
    body: 'Floor pan, two longitudinal rails, a cross member over each axle, and the firewall that splits engine from cabin. The car gets its geometry here and never loses it.',
  },
  {
    id: 'engine',
    label: '03 / Engine & Drivetrain',
    title: 'Dropped In',
    body: 'A sixty-degree V8 lowers onto its mounts, the way a real line does it — straight down, nothing else in the way. Four primaries a side gather into a collector under each bank.',
  },
  {
    id: 'body-panels',
    label: '04 / Body Panels',
    title: 'Skin',
    body: 'Sills, arches, doors, hood, deck lid, bumpers. Each one arrives on its own path and stops dead in its place. Panel gaps are the first thing anyone notices and the last thing anyone forgives.',
  },
  {
    id: 'paint',
    label: '05 / Paint',
    title: 'Colour Under Glass',
    body: 'Metallic base, then clear over the top. The clear coat is the whole trick: a second, sharper reflection sitting above the colour. It stops looking like a painted surface and starts looking like depth.',
  },
  {
    id: 'interior',
    label: '06 / Interior & Glass',
    title: 'The Cabin',
    body: 'Seats, dash, windscreen, side glass. The first parts on this car shaped around a person rather than a load path.',
  },
  {
    id: 'wheels',
    label: '07 / Wheels & Final Assembly',
    title: 'On Its Own Weight',
    body: 'Four wheels roll the length of the car and tuck into the arches. The moment they take the load it stops being a shell and starts being a vehicle.',
  },
  {
    id: 'reveal',
    label: '08 / Reveal',
    title: 'Finished',
    body: 'Sixteen parts here. Eleven thousand in the real thing. Either way, the order is the only part that is not negotiable.',
  },
]

export const HERO_SECTION = SECTION_COPY[0]
