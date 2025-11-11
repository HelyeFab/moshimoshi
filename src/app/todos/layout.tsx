import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Todo List - Task Management',
  description: 'Manage your personal todo list and tasks for Japanese learning.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/todos',
  },
}

export default function TodosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
