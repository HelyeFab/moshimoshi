'use client';

import { useAdmin } from '@/hooks/useAdmin';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useTheme } from '@/lib/theme/ThemeContext';
import { debugLog } from '@/lib/logger/debug-logger';
import { Dialog, Transition } from '@headlessui/react';

const log = debugLog('app:admin:layout');

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdmin, isLoading, error, user } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-850">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-850">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'You do not have admin privileges'}</p>
          <Link href="/" className="inline-block px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">Return to Home</Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/resources', label: 'Resources', icon: '📚' },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: '💳' },
    { href: '/admin/entitlements', label: 'Entitlements', icon: '🔐' },
    { href: '/admin/decision-explorer', label: 'Decision Logs', icon: '🔎' },
    { href: '/admin/monitoring', label: 'Monitoring', icon: '📈' },
    { href: '/admin/firebase-monitoring', label: 'Firebase Monitor', icon: '🔥' },
    { href: '/admin/moodboards', label: 'Moodboards', icon: '🎨' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname?.startsWith(href) || false;
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-dark-850 w-full transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full z-40 bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-dark-700/50 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} hidden lg:block`}>
        <div className="flex items-center justify-between h-16 px-6">
          <span className="text-2xl">🛡️</span>
          {sidebarOpen && <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin</h1>}
        </div>
        <nav className="mt-4 px-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg transition-colors group relative ${
                isActiveRoute(item.href)
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
              {!sidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/70 dark:bg-dark-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-dark-700/50 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors" aria-label="Toggle sidebar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => setShowMobileMenu(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors" aria-label="Toggle mobile menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors" aria-label="User menu">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                A
              </div>
            </button>
            <Transition
              as={Fragment}
              show={showUserMenu}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-850 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Admin</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">App Dashboard</Link>
                  <Link href="/" className="block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Exit Admin</Link>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <Transition.Root show={showMobileMenu} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setShowMobileMenu}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-dark-900 px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">🛡️</span>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin</h1>
                    </div>
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setShowMobileMenu(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <svg className="h-6 w-6 text-gray-900 dark:text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navItems.map((item) => (
                            <li key={item.label}>
                              <Link
                                href={item.href}
                                onClick={() => setShowMobileMenu(false)}
                                className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                                  isActiveRoute(item.href)
                                    ? 'bg-gray-50 text-primary-600'
                                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                }`}
                              >
                                <span className="text-xl">{item.icon}</span>
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0">
        <div className="w-full p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
