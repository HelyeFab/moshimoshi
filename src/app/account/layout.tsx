import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Settings - Manage Your Japanese Learning Profile',
  description: 'Manage your Moshimoshi account settings, subscription, billing, and learning preferences. Update profile information, change password, and configure notifications.',
  keywords: [
    'Japanese learning account',
    'account settings',
    'manage subscription',
    'billing settings',
    'profile settings',
    'account management',
  ],
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/account',
  },
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
