'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

interface ReCaptchaContextType {
  executeRecaptcha: (action: string) => Promise<string | null>
  isLoaded: boolean
}

const ReCaptchaContext = createContext<ReCaptchaContextType>({
  executeRecaptcha: async () => null,
  isLoaded: false,
})

export const useReCaptcha = () => useContext(ReCaptchaContext)

interface ReCaptchaProviderProps {
  children: ReactNode
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export function ReCaptchaProvider({ children }: ReCaptchaProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  const pathname = usePathname()
  const isE2EBypass =
    process.env.NEXT_PUBLIC_E2E_BYPASS_RECAPTCHA === 'true' ||
    process.env.E2E_BYPASS_RECAPTCHA === 'true'
  const allowAllPages = process.env.NEXT_PUBLIC_RECAPTCHA_ALL_PAGES === 'true'

  // Skip reCAPTCHA if not configured
  const isConfigured = siteKey && !siteKey.includes('YOUR_RECAPTCHA') && !isE2EBypass
  const isRelevantRoute = useMemo(() => {
    if (!pathname) return false
    return pathname.includes('/auth') || pathname.includes('/waitlist')
  }, [pathname])
  const shouldLoad = isConfigured && (allowAllPages || isRelevantRoute)

  useEffect(() => {
    if (isE2EBypass) {
      console.warn('[ReCAPTCHA] E2E bypass enabled')
      setIsLoaded(true)
      return
    }
    if (!isConfigured) {
      console.warn('[ReCAPTCHA] Not configured - skipping. Get keys from: https://www.google.com/recaptcha/admin')
      setIsLoaded(true) // Allow forms to work without reCAPTCHA
      return
    }
    if (!shouldLoad) {
      setIsLoaded(true)
      return
    }

    // Check if already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsLoaded(true)
      })
    }
  }, [isConfigured, shouldLoad, isE2EBypass])

  const handleScriptLoad = useCallback(() => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsLoaded(true)
        console.log('[ReCAPTCHA] Loaded successfully')
      })
    }
  }, [])

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    // If not configured, return null (bypass)
    if (!isConfigured) {
      console.log('[ReCAPTCHA] Not configured, bypassing verification')
      return null
    }
    if (!shouldLoad) {
      return null
    }

    if (!isLoaded || !window.grecaptcha) {
      console.warn('[ReCAPTCHA] Not loaded yet')
      return null
    }

    try {
      const token = await window.grecaptcha.execute(siteKey!, { action })
      return token
    } catch (error) {
      console.error('[ReCAPTCHA] Error executing:', error)
      return null
    }
  }, [isLoaded, siteKey, isConfigured])

  return (
    <ReCaptchaContext.Provider value={{ executeRecaptcha, isLoaded }}>
      {shouldLoad && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
          onLoad={handleScriptLoad}
          strategy="afterInteractive"
        />
      )}
      {children}
    </ReCaptchaContext.Provider>
  )
}
