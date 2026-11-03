/**
 * Render quality tiers.
 *
 * The old split was binary — `lowPower` or everything — and keyed on CPU core
 * count. That put a typical laptop (8 threads, Intel UHD 620) on the full path:
 * N8AO, six area lights, VSM shadows and a contact-shadow pass, measured at
 * 11–15 fps at 1440x900. The GPU is what decides this scene's frame rate, so the
 * GPU is what the tier is chosen from now, and the middle tier keeps the parts of
 * the look that are cheap (bloom, AgX, shadows) while dropping the two passes that
 * cost the most per pixel (screen-space AO and the LTC area lights).
 *
 * The heuristic only picks the starting point. AdaptiveQuality then measures the
 * real frame rate behind the loading screen and steps down if it has to.
 *
 * Deliberately free of three imports: this is read by the store, which ships in
 * the entry chunk ahead of the WebGL bundle.
 */
export type QualityTier = 'high' | 'medium' | 'low'

export const QUALITY_TIERS: readonly QualityTier[] = ['high', 'medium', 'low']

export interface QualitySettings {
  /** Composer with bloom, AgX, vignette and SMAA. Off means the renderer tone
   *  maps (also AgX, so the look holds across tiers) and draws straight out. */
  post: boolean
  /** N8AO. The single most expensive pass in the chain. */
  ao: boolean
  /** The six RectAreaLight ceiling strips. Every lit fragment pays for all six. */
  areaLights: boolean
  /** Spotlight shadow map. */
  shadows: boolean
  /** Car-only contact shadow under the sills. 0 disables it. */
  contactResolution: number
  /** Floor on the PBR material (specular sheen under the gantry lamp) rather
   *  than Lambert. The floor covers ~40% of most frames, so this is fill rate. */
  pbrFloor: boolean
  /** Device-pixel-ratio range the runtime governor may move within. */
  maxDpr: number
  minDpr: number
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: {
    post: true,
    ao: true,
    areaLights: true,
    shadows: true,
    contactResolution: 512,
    pbrFloor: true,
    maxDpr: 2,
    minDpr: 1,
  },
  medium: {
    post: true,
    ao: false,
    areaLights: false,
    shadows: true,
    contactResolution: 256,
    pbrFloor: true,
    maxDpr: 1.5,
    minDpr: 0.75,
  },
  low: {
    post: false,
    ao: false,
    areaLights: false,
    shadows: false,
    contactResolution: 0,
    pbrFloor: false,
    maxDpr: 1.25,
    minDpr: 0.6,
  },
}

export function lowerTier(tier: QualityTier): QualityTier {
  return tier === 'high' ? 'medium' : 'low'
}

function isTier(value: unknown): value is QualityTier {
  return value === 'high' || value === 'medium' || value === 'low'
}

/** Unmasked GPU string, or null when WebGL2 is missing entirely. */
function gpuRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    // Hand the context straight back; browsers cap live contexts per page.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return renderer
  } catch {
    return null
  }
}

const CACHE_KEY = 'car-assembly:quality'

interface CachedTier {
  gpu: string
  tier: QualityTier
  dpr: number
}

function readCachedTier(gpu: string): CachedTier | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedTier>
    if (parsed.gpu !== gpu || !isTier(parsed.tier)) return null
    return { gpu, tier: parsed.tier, dpr: typeof parsed.dpr === 'number' ? parsed.dpr : 0 }
  } catch {
    return null
  }
}

/**
 * Remembers where calibration landed — tier and resolution — so the next visit
 * starts there instead of paying the same measurement, and any shader rebuild,
 * again. Keyed on the GPU string, so a different machine on the same profile
 * starts fresh.
 */
export function rememberTier(tier: QualityTier, dpr: number) {
  if (!detectedGpu) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ gpu: detectedGpu, tier, dpr } satisfies CachedTier))
  } catch {
    // Storage unavailable: calibration simply reruns next visit.
  }
}

/** Resolution a cached calibration settled on, or 0 for "start at the tier's
 *  ceiling". Read by AdaptiveQuality once the tier is known. */
export let cachedDpr = 0

let detectedGpu: string | null = null

export interface InitialQuality {
  tier: QualityTier
  /** True when the tier came from a URL override or an earlier calibration, so
   *  measuring again would only cost load time. */
  trusted: boolean
}

/**
 * Starting tier. `?quality=high|medium|low` forces one (`?lowpower` is kept as an
 * alias for low); otherwise a cached calibration result wins; otherwise the GPU
 * string decides.
 */
export function detectInitialQuality(): InitialQuality {
  const params = new URLSearchParams(window.location.search)
  const forced = params.get('quality')
  if (isTier(forced)) return { tier: forced, trusted: true }
  if (params.has('lowpower')) return { tier: 'low', trusted: true }

  const gpu = gpuRenderer()
  if (!gpu) return { tier: 'low', trusted: true }
  detectedGpu = gpu

  const cached = readCachedTier(gpu)
  if (cached) {
    cachedDpr = cached.dpr
    return { tier: cached.tier, trusted: true }
  }

  const r = gpu.toLowerCase()
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(r)) return { tier: 'low', trusted: true }

  // Phones and tablets. Thermal limits make even a fast mobile GPU a poor bet for
  // the full chain, and the screens are dense enough that DPR is the bigger cost.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (coarse) return { tier: /apple|adreno \(tm\) 7|adreno \(tm\) 8/.test(r) ? 'medium' : 'low', trusted: false }

  // Discrete GPUs and Apple silicon.
  if (/nvidia|geforce|quadro|rtx|radeon rx|radeon pro|apple m\d|apple gpu|arc\(tm\) a/.test(r)) {
    return { tier: 'high', trusted: false }
  }

  // Everything else on a desktop is an integrated part: Intel HD/UHD/Iris, AMD
  // "Radeon Graphics" APUs, ARM laptops.
  return { tier: 'medium', trusted: false }
}
