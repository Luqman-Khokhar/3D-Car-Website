import { useEffect, useState } from 'react'
import { useSceneStore } from '@/store/useSceneStore'

const HINT_KEY = 'car-assembly:seen-freelook-hint'

function hasSeenHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

function markHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Private mode / blocked storage — hint just reshows next visit, not fatal.
  }
}

/**
 * One-time coachmark pointing at the 360° toggle. The light switches, garage
 * door and wall clock are all live objects, but every one of them is reachable
 * only in free look — and nothing in the scroll story hints that free look
 * exists — so a first-time visitor has no way to stumble onto them. This nudges
 * once, then dismisses itself the moment the user opens free look or closes the
 * bubble, and never shows again on this device.
 */
export function FeatureHint() {
  const freeLook = useSceneStore((s) => s.freeLook)
  const modelReady = useSceneStore((s) => s.modelReady)
  const [dismissed, setDismissed] = useState(hasSeenHint)

  useEffect(() => {
    if (freeLook && !dismissed) {
      setDismissed(true)
      markHintSeen()
    }
  }, [freeLook, dismissed])

  if (!modelReady || dismissed || freeLook) return null

  return (
    <div className="pointer-events-none fixed top-[10.75rem] right-5 z-30 flex justify-end md:top-[12.25rem] md:right-6">
      <div className="pointer-events-auto relative max-w-[13rem] rounded-2xl border border-stone-300/60 bg-black/70 px-4 py-3 text-stone-100 shadow-lg backdrop-blur-sm">
        <span
          aria-hidden="true"
          className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 border-t border-l border-stone-300/60 bg-black/70"
        />
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            markHintSeen()
          }}
          aria-label="Dismiss hint"
          className="absolute top-1.5 right-2 leading-none text-stone-400 hover:text-stone-100"
        >
          ×
        </button>
        <p className="pr-3 font-mono text-[0.65rem] leading-relaxed tracking-wide">
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 align-middle"
          />
          Switches, the garage door and the clock are all live — try{' '}
          <span className="text-stone-50">360° View</span>, or{' '}
          <span className="text-stone-50">Transform</span> to stand the car up.
        </p>
      </div>
    </div>
  )
}
