const DEVICE_ID_KEY = 'flashcards_device_id'

export function getFlashcardsDeviceId(): string | null {
  if (typeof window === 'undefined') return null

  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      deviceId = crypto.randomUUID()
    } else {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}
