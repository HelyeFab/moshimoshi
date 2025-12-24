'use client';

import { CountdownTimer } from '@/components/waitlist/CountdownTimer';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';
import { useTranslation } from '@/i18n/I18nContext';
import { strings as enStrings } from '@/i18n/locales/en/strings';
import { LAUNCH_DATE } from '@/lib/prelaunch/config';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function WaitlistPage() {
  const { strings, language } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Track waitlist page visit (anonymous - no auth required)
    fetch('/api/waitlist/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'waitlist' }),
    }).catch((err) => console.error('Failed to track visit:', err));
  }, []);

  // Use waitlist strings with fallback
  const t = mounted && strings?.waitlist ? strings.waitlist : enStrings.waitlist;

  // Format launch date per locale, fall back to English formatting
  const launchDateFormatter = new Intl.DateTimeFormat(language || 'en', {
    month: 'long',
    day: 'numeric',
  });
  const launchDateShortFormatter = new Intl.DateTimeFormat(language || 'en', {
    month: 'short',
    day: 'numeric',
  });
  const launchDateLong = launchDateFormatter.format(LAUNCH_DATE);
  const launchDateShort = launchDateShortFormatter.format(LAUNCH_DATE);
  const badgeText = `${t?.badgePrefix || 'Launching'} ${launchDateLong}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-japanese-mizu/10 dark:from-dark-950 dark:via-dark-900 dark:to-dark-850 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Sakura blob - top right */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-japanese-sakura/20 dark:bg-japanese-sakuraDark/15 rounded-full blur-3xl animate-pulse" />

        {/* Mizu blob - bottom left */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-japanese-mizu/30 dark:bg-japanese-mizu/10 rounded-full blur-3xl animate-pulse delay-700" />

        {/* Zen blob - center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-japanese-zen/10 dark:bg-japanese-zen/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:py-16 md:py-24">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/doshi.png"
              alt="Moshimoshi"
              width={60}
              height={60}
              className="rounded-2xl"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-primary-600 to-japanese-sakura bg-clip-text text-transparent dark:from-white dark:via-primary-400 dark:to-japanese-sakura">
              Moshimoshi
            </span>
          </Link>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-100 to-japanese-sakura/20 dark:from-primary-900/30 dark:to-japanese-sakuraDark/20 rounded-full mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {badgeText}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-gray-900 via-primary-600 to-japanese-sakura bg-clip-text text-transparent dark:from-white dark:via-primary-400 dark:to-japanese-sakura">
              {t?.titleLine1 || 'Learn Japanese'}
            </span>
            <br />
            <span className="text-gray-700 dark:text-gray-300">
              {t?.titleLine2 || 'The Fun Way'}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {t?.subtitle || 'YouTube shadowing, native news articles, AI stories, Moshi Comics, Anki import, and much more.'}
            {' '}
            <span className="font-bold text-primary-600 dark:text-primary-400">{t?.discountHighlight || '25% off for early supporters!'}</span>
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="mb-12">
          <h2 className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
            {t?.launchingIn || 'Launching In'}
          </h2>
          <CountdownTimer targetDate={LAUNCH_DATE} labels={t?.countdown} />
        </div>

        {/* Waitlist Form */}
        <div className="mb-16">
          <WaitlistForm />
        </div>

        {/* Features Preview - 9 features, responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          <FeatureCard
            icon="あ"
            title={t?.features?.kana?.title || 'Hiragana & Katakana'}
            description={t?.features?.kana?.description || 'Master Japanese alphabets'}
          />
          <FeatureCard
            icon="漢"
            title={t?.features?.kanji?.title || 'Kanji Mastery'}
            description={t?.features?.kanji?.description || '2,000+ kanji with mnemonics'}
          />
          <FeatureCard
            icon="📖"
            title={t?.features?.textbooks?.title || 'Genki & Minna'}
            description={t?.features?.textbooks?.description || 'Full textbook vocabulary'}
          />
          <FeatureCard
            icon="🎬"
            title={t?.features?.shadowing?.title || 'YouTube Shadowing'}
            description={t?.features?.shadowing?.description || 'Learn with native videos'}
          />
          <FeatureCard
            icon="📰"
            title={t?.features?.news?.title || 'Native News'}
            description={t?.features?.news?.description || 'Real Japanese articles'}
          />
          <FeatureCard
            icon="📚"
            title={t?.features?.stories?.title || 'AI Stories'}
            description={t?.features?.stories?.description || 'Stories at your level'}
          />
          <FeatureCard
            icon="🎌"
            title={t?.features?.comics?.title || 'Moshi Comics'}
            description={t?.features?.comics?.description || 'Original manga series'}
          />
          <FeatureCard
            icon="🃏"
            title={t?.features?.anki?.title || 'Anki Import'}
            description={t?.features?.anki?.description || 'Bring your flashcards'}
          />
          <FeatureCard
            icon="✏️"
            title={t?.features?.conjugation?.title || 'Conjugation Drills'}
            description={t?.features?.conjugation?.description || '100+ verb forms'}
          />
        </div>

        {/* Social Proof / Trust */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>{t?.socialProof || 'Be among the first to experience Moshimoshi'}</p>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/terms" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              {t?.footer?.terms || 'Terms of Service'}
            </Link>
            <Link href="/privacy" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              {t?.footer?.privacy || 'Privacy Policy'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 sm:p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start gap-3 sm:block">
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-gradient-to-br from-primary-100 to-japanese-sakura/30 dark:from-primary-900/50 dark:to-japanese-sakuraDark/30 rounded-xl flex items-center justify-center sm:mb-4">
          <span className="text-xl sm:text-2xl">{icon}</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
