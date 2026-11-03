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
  const [dismissed, setDismissed] = useState(hasSeenHint)

  useEffect(() => {
    if (freeLook && !dismissed) {
      setDismissed(true)
      markHintSeen()
    }
  }, [freeLook, dismissed])

  if (dismissed || freeLook) return null

  // Anchored to the left of the 360° button it is about, with the arrow pointing
  // straight at it. It used to hang under the whole stack with an arrow aimed at
  // the scroll-speed control, three buttons away from the one it names.
  return (
    <div
      role="note"
      className="absolute top-0 right-full mr-3 w-[min(13rem,calc(100vw-13rem))] rounded-2xl border border-stone-300/50 bg-black/75 px-4 py-3 text-stone-100 shadow-lg backdrop-blur-sm motion-safe:animate-[hint-in_400ms_ease-out_600ms_both]"
    >
      <span
        aria-hidden="true"
        className="absolute top-3.5 -right-1.5 h-3 w-3 rotate-45 border-t border-r border-stone-300/50 bg-black/75"
      />
      <button
        type="button"
        onClick={() => {
          setDismissed(true)
          markHintSeen()
        }}
        aria-label="Dismiss hint"
        className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full leading-none text-stone-400 transition-colors hover:text-stone-100 focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none"
      >
        ×
      </button>
      <p className="pr-4 font-mono text-[0.65rem] leading-relaxed tracking-wide">
        <span
          aria-hidden="true"
          className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 align-middle motion-reduce:animate-none"
        />
        Switches, the garage door and the clock are all live — try{' '}
        <span className="text-stone-50">360° View</span>, or{' '}
        <span className="text-stone-50">Transform</span> to stand the car up.
      </p>
    </div>
  )
}
