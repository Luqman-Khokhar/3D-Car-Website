import { useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

/**
 * Pointer cursor for clickable things in the scene (door button, wall switches).
 *
 * Each of those used to write `document.body.style.cursor` from its own effect,
 * so moving straight from one switch to the next raced: whichever effect ran last
 * won, and the cursor could stick on `auto` over a live switch or on `pointer`
 * over bare wall. A single hover count fixes the race, and setting a flag on
 * <html> rather than an inline cursor lets the stylesheet decide what the canvas
 * shows — see `data-scene-hover` in index.css, which also has to beat the
 * grab/grabbing cursor free look puts on the canvas.
 */
let hovered = 0

function apply() {
  if (hovered > 0) document.documentElement.dataset.sceneHover = ''
  else delete document.documentElement.dataset.sceneHover
}

export function useHoverCursor() {
  const over = useRef(false)

  // Unmounting mid-hover (free look switched off with the cursor on a switch)
  // must give its count back or the pointer sticks for the rest of the session.
  useEffect(
    () => () => {
      if (!over.current) return
      over.current = false
      hovered--
      apply()
    },
    [],
  )

  return {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      if (over.current) return
      over.current = true
      hovered++
      apply()
    },
    onPointerOut: () => {
      if (!over.current) return
      over.current = false
      hovered--
      apply()
    },
  }
}
