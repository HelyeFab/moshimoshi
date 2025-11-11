import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings - Customize Your Japanese Learning Experience',
  description: 'Customize your Japanese learning preferences. Adjust SRS settings, shadowing playback speed, notification preferences, and study goals. Personalize your learning journey.',
  keywords: [
    'Japanese learning settings',
    'customize Japanese app',
    'learning preferences',
    'SRS settings',
    'shadowing playback speed',
    'Japanese study customization',
    'learning app settings',
    'personalized Japanese learning',
    'study preferences',
    'Japanese app configuration',
  ],
  openGraph: {
    title: 'Settings - Customize Your Japanese Learning Experience',
    description: 'Personalize your Japanese learning with customizable settings and preferences',
    url: 'https://moshimoshi.app/settings',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/settings',
  },
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
