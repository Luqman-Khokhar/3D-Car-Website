import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const snapshot = () => window.matchMedia(QUERY).matches

/** True on touch-first devices. Live, so a 2-in-1 docking a mouse updates. */
export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
