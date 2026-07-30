import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Per-frame scroll progress as a ref instead of state.
 *
 * The store's scrollProgress is quantized and re-renders subscribers, which is
 * fine for HUD text but too coarse and too expensive for useFrame consumers.
 * This subscribes transiently (no re-render) so 3D code reads a live 0..1 value.
 */
export function useScrollProxy(): RefObject<number> {
  const progress = useRef(useSceneStore.getState().scrollProgress)

  useEffect(() => {
    // zustand subscribe returns the unsubscriber and does NOT re-render this hook.
    return useSceneStore.subscribe((state) => {
      progress.current = state.scrollProgress
    })
  }, [])

  return progress
}
