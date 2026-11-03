interface LoadingScreenProps {
  /** 0..100. */
  progress: number
  /** Fades out instead of unmounting hard, so the reveal is not a jump cut. */
  hidden?: boolean
}

/**
 * Full-screen loader. index.html carries a static copy of this exact markup
 * inside #root, so the page paints it before any JavaScript has run and React
 * then takes over the same pixels — keep the two in step.
 */
export function LoadingScreen({ progress, hidden = false }: LoadingScreenProps) {
  const percent = Math.round(progress)

  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-[var(--garage-wall)] transition-opacity duration-700 ease-out ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="text-3xl font-semibold tracking-tight text-stone-800">Assembly</p>
      <p className="mt-2 font-mono text-[0.65rem] tracking-[0.3em] text-stone-600 uppercase">
        Preparing the bay
      </p>
      <div
        role="progressbar"
        aria-label="Loading the garage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-8 h-px w-56 overflow-hidden bg-stone-400/70"
      >
        <div
          className="h-full origin-left bg-stone-800 transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${Math.max(progress, 2) / 100})` }}
        />
      </div>
      <p className="mt-3 font-mono text-[0.65rem] tracking-[0.2em] text-stone-600 tabular-nums">
        {percent}%
      </p>
    </div>
  )
}
