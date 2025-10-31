import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Verb Conjugation - Master Japanese Verbs',
  description: 'Learn Japanese verb conjugation with interactive practice. Master all forms: present, past, negative, te-form, potential, passive, and causative. Step-by-step conjugation guide.',
  keywords: [
    'Japanese verb conjugation',
    'conjugate Japanese verbs',
    'Japanese verb forms',
    'verb conjugation practice',
    'Japanese grammar verbs',
    'te-form Japanese',
    'Japanese verb endings',
    'learn Japanese verbs',
    'verb conjugation chart',
    'Japanese verb tenses',
  ],
  openGraph: {
    title: 'Japanese Verb Conjugation - Master Japanese Verbs',
    description: 'Learn Japanese verb conjugation with interactive practice. Master all forms and tenses.',
    url: 'https://moshimoshi.app/learn/conjugation',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/conjugation',
  },
}

export default function ConjugationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
