'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminLinks = [
  { href: '/admin', icon: '🏠', label: 'Dashboard' },
  { href: '/admin/resources', icon: '📚', label: 'Resources' },
  { href: '/admin/moodboards', icon: '🎨', label: 'Moodboards' },
  { href: '/admin/subscriptions', icon: '💳', label: 'Subscriptions' },
  { href: '/admin/blog', icon: '📝', label: 'Blog' },
  { href: '/admin/monitoring', icon: '📊', label: 'Monitoring' },
  { href: '/admin/entitlements', icon: '🔐', label: 'Entitlements' },
  { href: '/admin/xp-config', icon: '⚡', label: 'XP Config' },
  { href: '/admin/firebase-monitoring', icon: '🔥', label: 'Firebase' },
  { href: '/admin/youtube-series', icon: '📹', label: 'YouTube Series' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white dark:bg-dark-800 shadow-lg min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Admin Panel
        </h2>
        <nav className="space-y-2">
          {adminLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }
                `}
              >
                <span className="text-xl">{link.icon}</span>
                <span className="font-medium">{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}