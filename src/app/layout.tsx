import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/lib/theme/ThemeContext'
import { ToastProvider } from '@/components/ui/Toast/ToastContext'
// import { ContentProtectionProvider } from '@/components/providers/ContentProtectionProvider'
import { I18nProvider } from '@/i18n/I18nContext'
import { AuthProvider } from '@/hooks/useAuth' // Compatibility wrapper - not actually needed but keeps layout consistent
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider'
import { themeInitScript } from '@/lib/theme/theme-script'
import { suppressFirestoreErrors } from '@/lib/firebase/suppress-errors'
import '@/styles/globals.css'
import TimeMachineButton from '@/components/dev/TimeMachineButton'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Moshimoshi - Learn Japanese',
  description: 'The ultimate Japanese learning platform - from basics to fluency',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a202c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: suppressFirestoreErrors }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider defaultPosition="top-right">
                <ServiceWorkerProvider>
                  {children}
                  {process.env.NODE_ENV === 'development' && <TimeMachineButton />}
                </ServiceWorkerProvider>
              </ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}