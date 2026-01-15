'use client';

import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import EnhancedNav from './EnhancedNav';

/**
 * Global navigation wrapper that provides user context to EnhancedNav
 * Placed in root layout to show navigation on all pages
 */
export default function NavigationWrapper() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide navigation on auth pages only
  // Note: Home page (/) redirects authenticated users to /dashboard automatically
  const hideNav = pathname.startsWith('/auth/');

  if (hideNav) {
    return null;
  }

  return (
    <EnhancedNav
      user={user}
      showUserMenu={true}
      autoHideTopNav={true}
    />
  );
}
