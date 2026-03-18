import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const _t = await getTranslations(locale as Locale)

  return {
    ...(await generateLocalizedMetadata({
      path: '/moshi-player',
      title: 'Moshi Player - YouTube Video Player',
      description:
        'Watch YouTube videos with Japanese transcripts. Continuous playback with transcript display.',
    })),
    keywords: [
      'YouTube player',
      'Japanese transcript',
      'Japanese video learning',
      'YouTube Japanese',
      'video player with transcript',
    ],
  }
}

export default function MoshiPlayerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
