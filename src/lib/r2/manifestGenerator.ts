import type { R2Manifest, R2ManifestFile } from '@/types/r2'
import { hashBlob } from './hashUtils'

export async function generateManifest(
  deckId: string,
  userId: string,
  packageBlob: Blob,
  mediaFiles: Map<string, Blob>
): Promise<R2Manifest> {
  const files: R2ManifestFile[] = []

  const packageHash = await hashBlob(packageBlob)
  files.push({
    type: 'package',
    name: 'package.apkg',
    size: packageBlob.size,
    sha256: packageHash,
  })

  for (const [filename, blob] of mediaFiles.entries()) {
    files.push({
      type: 'media',
      name: filename,
      size: blob.size,
      sha256: await hashBlob(blob),
    })
  }

  return {
    deckId,
    userId,
    createdAt: new Date().toISOString(),
    files,
  }
}
