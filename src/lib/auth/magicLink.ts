export function buildDirectMagicLink(firebaseLink: string): string {
  try {
    const url = new URL(firebaseLink)
    const continueUrl = url.searchParams.get('continueUrl')
    const targetUrl = continueUrl ? new URL(continueUrl) : new URL(url.origin)

    if (!continueUrl) {
      targetUrl.pathname = '/en/auth/verify-magic-link'
    }

    const paramsToCopy = ['mode', 'oobCode', 'apiKey', 'lang']
    for (const key of paramsToCopy) {
      const value = url.searchParams.get(key)
      if (value) {
        targetUrl.searchParams.set(key, value)
      }
    }

    return targetUrl.toString()
  } catch (error) {
    console.warn('Failed to build direct magic link, using original link:', error)
    return firebaseLink
  }
}
