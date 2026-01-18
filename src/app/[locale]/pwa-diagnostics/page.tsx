'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type FetchCheck = {
  url: string
  ok: boolean
  status: number | null
  contentType: string | null
  error?: string
}

type ManifestInfo = {
  url: string | null
  fetch: FetchCheck | null
  data?: {
    name?: string
    short_name?: string
    start_url?: string
    scope?: string
    display?: string
    display_override?: string[]
    theme_color?: string
  } | null
  scopeCheck?: {
    scopeUrl: string | null
    currentPath: string
    withinScope: boolean | null
  }
}

type ServiceWorkerInfo = {
  supported: boolean
  controller: {
    hasController: boolean
    scriptURL: string | null
    state: string | null
  }
  registration: {
    scope: string | null
    activeState: string | null
    waitingState: string | null
    installingState: string | null
  } | null
  registrations: Array<{
    scope: string
    scriptURL: string | null
    state: string | null
  }>
  swFileChecks: FetchCheck[]
}

type PwaDiagnosticsReport = {
  timestamp: string
  location: {
    href: string
    origin: string
    pathname: string
    protocol: string
  }
  userAgent: string
  platform: string | null
  language: string | null
  online: boolean
  displayMode: {
    standalone: boolean
    minimalUi: boolean
    fullscreen: boolean
    browser: boolean
    navigatorStandalone: boolean
    androidAppReferrer: boolean
  }
  beforeInstallPromptFired: boolean
  manifest: ManifestInfo
  serviceWorker: ServiceWorkerInfo
  cacheStorage: {
    supported: boolean
    keys: string[]
  }
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="text-sm text-gray-900 dark:text-gray-100 break-words">{value}</div>
    </div>
  )
}

export default function PwaDiagnosticsPage() {
  const [report, setReport] = useState<PwaDiagnosticsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [beforeInstallPromptFired, setBeforeInstallPromptFired] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setBeforeInstallPromptFired(true)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const runDiagnostics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { location, navigator, document } = window

      const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
      const displayMinimalUi = window.matchMedia('(display-mode: minimal-ui)').matches
      const displayFullscreen = window.matchMedia('(display-mode: fullscreen)').matches
      const displayBrowser = window.matchMedia('(display-mode: browser)').matches

      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
      const manifestUrl = manifestLink?.href ?? null

      const fetchWithMeta = async (url: string): Promise<FetchCheck> => {
        try {
          const response = await fetch(url, { cache: 'no-store' })
          return {
            url,
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type'),
          }
        } catch (err) {
          return {
            url,
            ok: false,
            status: null,
            contentType: null,
            error: err instanceof Error ? err.message : 'unknown error',
          }
        }
      }

      const manifestFetch = manifestUrl ? await fetchWithMeta(manifestUrl) : null
      let manifestData: ManifestInfo['data'] = null
      if (manifestUrl && manifestFetch?.ok) {
        try {
          const response = await fetch(manifestUrl, { cache: 'no-store' })
          manifestData = await response.json()
        } catch (err) {
          manifestData = null
        }
      }

      const scopeUrl = manifestData?.scope
        ? new URL(manifestData.scope, location.origin).toString()
        : null
      const withinScope =
        manifestData?.scope != null ? location.pathname.startsWith(manifestData.scope) : null

      const registration = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null
      const registrations = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : []

      const swFileChecks = await Promise.all([
        fetchWithMeta(`${location.origin}/service-worker.js`),
        fetchWithMeta(`${location.origin}/service-worker.dev.js`)
      ])

      const cacheKeys = 'caches' in window ? await caches.keys() : []

      const nextReport: PwaDiagnosticsReport = {
        timestamp: new Date().toISOString(),
        location: {
          href: location.href,
          origin: location.origin,
          pathname: location.pathname,
          protocol: location.protocol,
        },
        userAgent: navigator.userAgent,
        platform: navigator.platform ?? null,
        language: navigator.language ?? null,
        online: navigator.onLine,
        displayMode: {
          standalone: displayStandalone,
          minimalUi: displayMinimalUi,
          fullscreen: displayFullscreen,
          browser: displayBrowser,
          navigatorStandalone: (navigator as any).standalone === true,
          androidAppReferrer: document.referrer.includes('android-app://'),
        },
        beforeInstallPromptFired,
        manifest: {
          url: manifestUrl,
          fetch: manifestFetch,
          data: manifestData,
          scopeCheck: {
            scopeUrl,
            currentPath: location.pathname,
            withinScope,
          },
        },
        serviceWorker: {
          supported: 'serviceWorker' in navigator,
          controller: {
            hasController: !!navigator.serviceWorker?.controller,
            scriptURL: navigator.serviceWorker?.controller?.scriptURL ?? null,
            state: navigator.serviceWorker?.controller?.state ?? null,
          },
          registration: registration
            ? {
                scope: registration.scope ?? null,
                activeState: registration.active?.state ?? null,
                waitingState: registration.waiting?.state ?? null,
                installingState: registration.installing?.state ?? null,
              }
            : null,
          registrations: registrations.map((reg) => ({
            scope: reg.scope,
            scriptURL: reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? null,
            state: reg.active?.state ?? reg.installing?.state ?? reg.waiting?.state ?? null,
          })),
          swFileChecks,
        },
        cacheStorage: {
          supported: 'caches' in window,
          keys: cacheKeys,
        },
      }

      setReport(nextReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [beforeInstallPromptFired])

  useEffect(() => {
    runDiagnostics()
  }, [runDiagnostics])

  const reportJson = useMemo(() => (report ? JSON.stringify(report, null, 2) : ''), [report])

  const handleCopy = useCallback(async () => {
    if (!reportJson) return
    try {
      await navigator.clipboard.writeText(reportJson)
      alert('Diagnostics copied to clipboard')
    } catch {
      alert('Copy failed - please select and copy manually')
    }
  }, [reportJson])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">PWA Diagnostics</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Use this page on your device to verify PWA installability. If Chrome shows
          &quot;Creating shortcut&quot;, check that the page is controlled by a service worker
          and the manifest is loaded correctly.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runDiagnostics}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Checking…' : 'Refresh Diagnostics'}
          </button>
          <button
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
            disabled={!reportJson}
          >
            Copy JSON Report
          </button>
        </div>
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {report && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <KeyValue label="Timestamp" value={report.timestamp} />
          <KeyValue label="Online" value={report.online ? 'true' : 'false'} />
          <KeyValue label="Location" value={report.location.href} />
          <KeyValue label="Protocol" value={report.location.protocol} />
          <KeyValue label="User Agent" value={report.userAgent} />
          <KeyValue label="Platform" value={report.platform ?? 'unknown'} />
          <KeyValue label="Language" value={report.language ?? 'unknown'} />
          <KeyValue label="Display Mode - Standalone" value={report.displayMode.standalone ? 'true' : 'false'} />
          <KeyValue label="Display Mode - Minimal UI" value={report.displayMode.minimalUi ? 'true' : 'false'} />
          <KeyValue label="Display Mode - Browser" value={report.displayMode.browser ? 'true' : 'false'} />
          <KeyValue label="Navigator Standalone (iOS)" value={report.displayMode.navigatorStandalone ? 'true' : 'false'} />
          <KeyValue label="Android App Referrer" value={report.displayMode.androidAppReferrer ? 'true' : 'false'} />
          <KeyValue label="beforeinstallprompt fired" value={report.beforeInstallPromptFired ? 'true' : 'false'} />
          <KeyValue label="Manifest URL" value={report.manifest.url ?? 'not found'} />
          <KeyValue
            label="Manifest Fetch"
            value={
              report.manifest.fetch
                ? `${report.manifest.fetch.status} (${report.manifest.fetch.ok ? 'ok' : 'fail'}) ${report.manifest.fetch.contentType ?? ''}`
                : 'not fetched'
            }
          />
          <KeyValue label="Manifest scope" value={report.manifest.data?.scope ?? 'n/a'} />
          <KeyValue label="Manifest start_url" value={report.manifest.data?.start_url ?? 'n/a'} />
          <KeyValue
            label="Within scope"
            value={
              report.manifest.scopeCheck?.withinScope == null
                ? 'n/a'
                : report.manifest.scopeCheck.withinScope
                ? 'true'
                : 'false'
            }
          />
          <KeyValue label="SW Supported" value={report.serviceWorker.supported ? 'true' : 'false'} />
          <KeyValue label="SW Controller" value={report.serviceWorker.controller.hasController ? 'true' : 'false'} />
          <KeyValue label="SW Controller Script" value={report.serviceWorker.controller.scriptURL ?? 'n/a'} />
          <KeyValue label="SW Controller State" value={report.serviceWorker.controller.state ?? 'n/a'} />
          <KeyValue label="SW Registration Scope" value={report.serviceWorker.registration?.scope ?? 'n/a'} />
          <KeyValue
            label="SW Active State"
            value={report.serviceWorker.registration?.activeState ?? 'n/a'}
          />
          <KeyValue
            label="SW Waiting State"
            value={report.serviceWorker.registration?.waitingState ?? 'n/a'}
          />
          <KeyValue
            label="SW Installing State"
            value={report.serviceWorker.registration?.installingState ?? 'n/a'}
          />
          <KeyValue
            label="SW File Check (/service-worker.js)"
            value={`${report.serviceWorker.swFileChecks[0]?.status ?? 'n/a'} (${report.serviceWorker.swFileChecks[0]?.ok ? 'ok' : 'fail'})`}
          />
          <KeyValue
            label="SW File Check (/service-worker.dev.js)"
            value={`${report.serviceWorker.swFileChecks[1]?.status ?? 'n/a'} (${report.serviceWorker.swFileChecks[1]?.ok ? 'ok' : 'fail'})`}
          />
          <KeyValue
            label="Cache Storage Keys"
            value={report.cacheStorage.keys.length ? report.cacheStorage.keys.join(', ') : 'none'}
          />
        </div>
      )}

      {report && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Raw JSON</h2>
          <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            {reportJson}
          </pre>
        </div>
      )}
    </div>
  )
}
