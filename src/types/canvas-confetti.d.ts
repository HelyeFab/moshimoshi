declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number
    angle?: number
    spread?: number
    startVelocity?: number
    decay?: number
    gravity?: number
    drift?: number
    ticks?: number
    origin?: {
      x?: number
      y?: number
    }
    colors?: string[]
    shapes?: ('square' | 'circle')[]
    scalar?: number
    zIndex?: number
    disableForReducedMotion?: boolean
  }

  interface ConfettiCannon {
    (options?: ConfettiOptions): Promise<null>
    reset: () => void
    create: (
      canvas: HTMLCanvasElement,
      globalOptions?: { resize?: boolean; useWorker?: boolean }
    ) => ConfettiCannon
  }

  const confetti: ConfettiCannon
  export = confetti
}
