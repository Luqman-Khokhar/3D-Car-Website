import { useEffect } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useSceneStore } from '@/store/useSceneStore'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import { resetTouchDrive, touchDrive } from '@/animations/driveInput'
import { requestFrame } from '@/lib/frame'

type Axis = 'throttle' | 'turn'

interface PadButtonProps {
  axis: Axis
  value: 1 | -1
  label: string
  children: ReactNode
}

/**
 * One hold-to-drive button. Pointer capture keeps the press alive if the thumb
 * slides off the button mid-corner, and release, cancel and capture loss all
 * zero the axis, so a call or a notification cannot leave the car with its
 * throttle pinned open.
 */
function PadButton({ axis, value, label, children }: PadButtonProps) {
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    touchDrive[axis] = value
    requestFrame()
  }
  const release = () => {
    if (touchDrive[axis] === value) touchDrive[axis] = 0
    requestFrame()
  }

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      className="grid h-16 w-16 touch-none place-items-center rounded-full border border-stone-300/40 bg-black/40 text-stone-100 backdrop-blur-sm transition-[background-color,transform] duration-100 select-none active:scale-95 active:bg-stone-100/25"
    >
      {children}
    </button>
  )
}

const chevron = (rotate: number) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" style={{ transform: `rotate(${rotate}deg)` }}>
    <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * On-screen driving for touch devices. The drive mode was keyboard-only, so on a
 * phone or tablet free look let you open the door and then had no way to take
 * the car out of it. Steering on the left thumb, throttle and brake on the
 * right — the layout every mobile racing game has trained people into.
 *
 * Only on a coarse pointer, only in free look, never for the robot.
 */
export function TouchDrivePad() {
  const touch = useCoarsePointer()
  const freeLook = useSceneStore((s) => s.freeLook)
  const robotMode = useSceneStore((s) => s.robotMode)
  const visible = touch && freeLook && !robotMode

  // Leaving the mode with a thumb still down must not carry the input over.
  useEffect(() => {
    if (!visible) resetTouchDrive()
    return resetTouchDrive
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="group"
      aria-label="Drive controls"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex gap-3">
        <PadButton axis="turn" value={1} label="Steer left">
          {chevron(-90)}
        </PadButton>
        <PadButton axis="turn" value={-1} label="Steer right">
          {chevron(90)}
        </PadButton>
      </div>
      <div className="pointer-events-auto flex flex-col gap-3">
        <PadButton axis="throttle" value={1} label="Accelerate">
          {chevron(0)}
        </PadButton>
        <PadButton axis="throttle" value={-1} label="Brake and reverse">
          {chevron(180)}
        </PadButton>
      </div>
    </div>
  )
}
