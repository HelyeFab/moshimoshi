import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast/ToastContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { AuthProvider } from '@/hooks/useAuth';
import { ReCaptchaProvider } from '@/components/ReCaptchaProvider';
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { PWAInstallToast } from '@/components/pwa/PWAInstallToast';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { AppRenderedMarker } from '@/components/pwa/AppRenderedMarker';
import { TTSLoadingProvider } from '@/components/tts';
import CelebrationProvider from '@/components/gamification/CelebrationProvider';
import { ConjugationHelpProvider } from '@/contexts/ConjugationHelpContext';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { SundayContentBanner } from '@/components/banners/SundayContentBanner';
import { FeatureAnnouncementOverlay } from '@/components/announcements/FeatureAnnouncementOverlay';
import LearningVillageTracker from '@/components/analytics/LearningVillageTracker';
import PageVisitTracker from '@/components/analytics/PageVisitTracker';
import PerfDebugPanel from '@/components/debug/PerfDebugPanel';
import ConditionalCommandPalette from '@/components/ui/ConditionalCommandPalette';
import TimeMachineButton from '@/components/dev/TimeMachineButton';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CoffeeBanner from '@/components/banners/CoffeeBanner';
import { locales, type Locale } from '@/i18n/routing';
import type { Language } from '@/i18n/config';

/**
 * Generate static params for all supported locales.
 * This enables static generation for locale-prefixed routes.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Locale-aware layout that wraps all routes under /[locale]/.
 *
 * This layout:
 * 1. Validates the locale parameter
 * 2. Sets the request locale for next-intl
 * 3. Wraps children with all necessary providers
 * 4. Passes the locale to I18nProvider for client-side translations
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  // Await params in Next.js 15
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering for this locale
  setRequestLocale(locale);

  return (
    <AuthProvider>
      <ReCaptchaProvider>
        <ToastProvider defaultPosition="top-right">
          <I18nProvider initialLanguage={locale as Language}>
            <ConjugationHelpProvider>
              <ThemeProvider>
                <ServiceWorkerProvider>
                  <CelebrationProvider>
                    <TTSLoadingProvider>
                      <FeatureAnnouncementOverlay />
                      <SundayContentBanner />
                      <OfflineBanner />
                      <EmailVerificationBanner />
                      <LearningVillageTracker />
                      <PageVisitTracker />
                      {children}
                      <CoffeeBanner />
                      <PerfDebugPanel />
                      {process.env.NODE_ENV === 'development' &&
                        process.env.NEXT_PUBLIC_ENABLE_TIME_MACHINE !== 'false' && (
                          <TimeMachineButton />
                        )}
                      <ConditionalCommandPalette />
                      <PWAInstallPrompt />
                      <PWAInstallToast />
                      <AppRenderedMarker />
                      <MobileBottomNav />
                    </TTSLoadingProvider>
                  </CelebrationProvider>
                </ServiceWorkerProvider>
              </ThemeProvider>
            </ConjugationHelpProvider>
          </I18nProvider>
        </ToastProvider>
      </ReCaptchaProvider>
    </AuthProvider>
  );
}
