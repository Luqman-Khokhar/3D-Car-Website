import { useEffect } from 'react'
import { useSceneStore } from '@/store/useSceneStore'

/** Manual override, e.g. ?lowpower=1 for testing the degraded path on a fast machine. */
function forcedLowPower() {
  return new URLSearchParams(window.location.search).has('lowpower')
}

function detectWebGL2() {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

/**
 * Classifies the device once on mount. Low power drops particles and
 * post-processing rather than swapping the whole experience.
 */
export function useDeviceTier() {
  useEffect(() => {
    if (forcedLowPower()) {
      useSceneStore.getState().setLowPower(true)
      return
    }

    const cores = navigator.hardwareConcurrency ?? 4
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const low = !detectWebGL2() || cores <= 4 || (coarsePointer && cores <= 6)

    useSceneStore.getState().setLowPower(low)
  }, [])
}
