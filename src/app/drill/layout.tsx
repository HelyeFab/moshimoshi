import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Conjugation Drill - Verb Practice Exercises',
  description: 'Practice Japanese verb conjugations with interactive drills. Master all verb forms through repetitive exercises. Track your progress and accuracy with instant feedback.',
  keywords: [
    'Japanese conjugation drill',
    'verb drill practice',
    'Japanese grammar drill',
    'conjugation practice',
    'Japanese verb practice',
    'verb conjugation exercises',
    'Japanese drill exercises',
    'grammar practice Japanese',
  ],
  openGraph: {
    title: 'Japanese Conjugation Drill - Verb Practice Exercises',
    description: 'Practice Japanese verb conjugations with interactive drills and instant feedback',
    url: 'https://moshimoshi.app/drill',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/drill',
  },
}

export default function DrillLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
