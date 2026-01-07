import { AnkiMediaStore } from './mediaStore'

/**
 * Hydrate Anki media in HTML content
 * Replaces image filenames with fresh blob URLs from IndexedDB
 *
 * This is necessary because blob URLs are ephemeral and don't survive page reloads.
 * We store filenames in the HTML, then hydrate with fresh blob URLs when rendering.
 */
export async function hydrateAnkiMedia(html: string): Promise<string> {
  if (!html) {
    console.log('[MediaHydrator] Empty HTML, skipping')
    return html
  }

  console.log('[MediaHydrator] ========== START HYDRATION ==========')
  console.log('[MediaHydrator] Input HTML length:', html.length)
  console.log('[MediaHydrator] Input HTML preview:', html.substring(0, 200))

  const mediaStore = AnkiMediaStore.getInstance()
  let hydratedHtml = html

  // Find all images with data-anki-media attribute
  const imgRegex = /<img[^>]+data-anki-media="([^"]+)"[^>]*>/gi
  const matches = [...html.matchAll(imgRegex)]

  console.log(`[MediaHydrator] Found ${matches.length} images with data-anki-media attribute`)

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const filename = match[1]
    const originalTag = match[0]

    console.log(`[MediaHydrator] --- Image #${i + 1}/${matches.length} ---`)
    console.log(`[MediaHydrator] Filename: "${filename}"`)
    console.log(`[MediaHydrator] Original tag:`, originalTag.substring(0, 100))

    // Get fresh blob URL from media store
    const blobUrl = await mediaStore.getMediaUrl(filename)

    console.log(`[MediaHydrator] Blob URL result:`, blobUrl ? blobUrl.substring(0, 50) + '...' : 'NULL')

    if (blobUrl) {
      // Replace the src attribute with the blob URL
      const hydratedTag = originalTag.replace(/src="[^"]*"/, `src="${blobUrl}"`)
      console.log(`[MediaHydrator] Hydrated tag:`, hydratedTag.substring(0, 100))

      hydratedHtml = hydratedHtml.replace(originalTag, hydratedTag)
      console.log(`[MediaHydrator] ✓ Successfully hydrated: ${filename}`)
    } else {
      console.error(`[MediaHydrator] ✗ FAILED - No blob URL found for: ${filename}`)
      console.error(`[MediaHydrator] This image will be broken in the UI!`)
    }
  }

  console.log('[MediaHydrator] ========== END HYDRATION ==========')
  console.log('[MediaHydrator] Output HTML length:', hydratedHtml.length)
  console.log('[MediaHydrator] Output HTML preview:', hydratedHtml.substring(0, 200))

  return hydratedHtml
}
