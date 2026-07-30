interface LoadingScreenProps {
  /** 0..100. */
  progress: number
  /** Fades out instead of unmounting hard, so the reveal is not a jump cut. */
  hidden?: boolean
}

export function LoadingScreen({ progress, hidden = false }: LoadingScreenProps) {
  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-0 z-30 flex flex-col items-center justify-center bg-[var(--garage-wall)] transition-opacity duration-700 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="font-mono text-xs tracking-[0.3em] text-stone-600 uppercase">
        Preparing assembly line
      </p>
      <div className="mt-6 h-px w-56 overflow-hidden bg-stone-400">
        <div
          className="h-full origin-left bg-stone-800 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${Math.max(progress, 2) / 100})` }}
        />
      </div>
      <p className="mt-4 font-mono text-xs tabular-nums text-stone-600">
        {Math.round(progress)}%
      </p>
    </div>
  )
}
