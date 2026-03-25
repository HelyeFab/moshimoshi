'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

const adminLinks = [
  { href: '/admin', icon: '🏠', label: 'Dashboard' },
  { href: '/admin/resources', icon: '📚', label: 'Resources' },
  { href: '/admin/stories', icon: '📖', label: 'Stories' },
  { href: '/admin/comics', icon: '🦝', label: 'Comics' },
  { href: '/admin/moodboards', icon: '🎨', label: 'Moodboards' },
  { href: '/admin/learning-village', icon: '🏘️', label: 'Learning Village' },
  { href: '/admin/blog', icon: '📝', label: 'Blog' },
  { href: '/admin/email-templates', icon: '✉️', label: 'Email Templates' },
  { href: '/admin/email-campaigns', icon: '📧', label: 'Email Campaigns' },
  { href: '/admin/announcements', icon: '📢', label: 'Announcements' },
  { href: '/admin/entitlements', icon: '🔐', label: 'Entitlements' },
  { href: '/admin/kanji-vocabulary-inspector', icon: '🧪', label: 'Kanji Inspector' },
  { href: '/admin/xp-config', icon: '⚡', label: 'XP Config' },
  { href: '/admin/firebase-monitoring', icon: '🔥', label: 'Firebase' },
  { href: '/admin/youtube-series', icon: '📹', label: 'YouTube Series' },
]

const trackingLinks = [
  { href: '/admin/village-traffic', icon: '🏮', label: 'Village Traffic' },
  { href: '/admin/content-clicks', icon: '📌', label: 'Content Clicks' },
  { href: '/admin/subscriptions', icon: '💳', label: 'Subscriptions' },
  { href: '/admin/auth-monitor', icon: '🛡️', label: 'Auth Monitor' },
  { href: '/admin/monitoring', icon: '📊', label: 'Monitoring' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [trackingOpen, setTrackingOpen] = useState(() =>
    trackingLinks.some(link => pathname === link.href)
  )

  const renderLink = (link: { href: string; icon: string; label: string }) => {
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
  }

  return (
    <aside className="w-64 bg-white dark:bg-dark-800 shadow-lg min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Admin Panel
        </h2>
        <nav className="space-y-2">
          {adminLinks.map(renderLink)}

          {/* Tracking subdrawer */}
          <div className="pt-2">
            <button
              onClick={() => setTrackingOpen(!trackingOpen)}
              className={`
                w-full flex items-center justify-between gap-3 px-4 py-2 rounded-lg transition-colors
                ${trackingLinks.some(link => pathname === link.href)
                  ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📈</span>
                <span className="font-medium">Tracking</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${trackingOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {trackingOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-dark-600 pl-2">
                {trackingLinks.map(renderLink)}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  )
}
