const HEX_PAD = 2

export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  if (!crypto?.subtle?.digest) {
    throw new Error('Web Crypto API unavailable for hashing')
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(HEX_PAD, '0')).join('')
}

export async function benchmarkHashing(): Promise<void> {
  const bytes = 1024 * 1024
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  const blob = new Blob([buffer])

  const start = performance.now()
  await hashBlob(blob)
  const end = performance.now()

  const elapsedMs = Math.round((end - start) * 100) / 100
  console.log(`[R2] SHA-256 1MB hash time: ${elapsedMs}ms`)
}
