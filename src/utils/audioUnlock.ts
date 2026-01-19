let audioUnlocked = false

export function unlockAudioOnUserGesture(): void {
  if (audioUnlocked) return
  if (typeof window === 'undefined') return

  try {
    const AudioContextCtor =
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (AudioContextCtor) {
      const context = new AudioContextCtor()
      if (context.state === 'suspended') {
        context.resume().catch(() => undefined)
      }
      const buffer = context.createBuffer(1, 1, 22050)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start(0)
      source.onended = () => {
        try {
          context.close()
        } catch {
          // Ignore close errors
        }
      }
      audioUnlocked = true
      return
    }
  } catch {
    // Ignore AudioContext errors and try HTMLAudio fallback
  }

  try {
    const audio = new Audio()
    audio.volume = 0
    audio.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          audio.pause()
        })
        .catch(() => {
          // Ignore unlock failures
        })
        .finally(() => {
          audioUnlocked = true
        })
    } else {
      audioUnlocked = true
    }
  } catch {
    // Ignore HTMLAudio unlock errors
  }
}
