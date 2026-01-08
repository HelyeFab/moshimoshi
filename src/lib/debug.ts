/**
 * Debug logging utility
 * Set localStorage.DEBUG = 'true' to enable debug logs
 */

const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('DEBUG') === 'true'
  } catch {
    return false
  }
}

export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log(...args)
    }
  },
  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.warn(...args)
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args)
  }
}
