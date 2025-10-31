import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Import Anki Decks - Migrate from Anki to Moshimoshi | Best Anki Alternative',
  description: 'Seamlessly import your Anki decks to Moshimoshi. Migrate from Anki with one click and experience modern Japanese SRS with better UI, YouTube shadowing integration, and smart review algorithm. Import APKG files, preserve scheduling data, and upgrade to the best Anki alternative for Japanese learning in 2025.',
  keywords: [
    'import Anki decks',
    'Anki to Moshimoshi',
    'migrate from Anki',
    'Anki alternative Japanese',
    'better than Anki',
    'Anki APKG import',
    'leave Anki for Moshimoshi',
    'Anki deck converter',
    'Anki migration tool',
    'modern Anki alternative',
    'Anki import Japanese',
    'transfer Anki cards',
    'Anki replacement SRS',
    'best Anki alternative 2025',
    'Kitsun alternative',
    'Mochi alternative',
  ],
  openGraph: {
    title: 'Import Anki Decks - Migrate to Best Anki Alternative for Japanese',
    description: 'Seamlessly import Anki decks and upgrade to modern Japanese SRS with YouTube shadowing and better UI',
    url: 'https://moshimoshi.app/anki-import',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/anki-import',
  },
}

export default function AnkiImportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
