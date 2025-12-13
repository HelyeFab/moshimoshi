'use client';

import { useEffect, useState } from 'react';
import { Mail, MailCheck, MailX } from 'lucide-react';

interface NewsletterStatus {
  subscribed: boolean;
  status: 'active' | 'pending' | 'unsubscribed' | 'not_subscribed' | 'guest' | 'unknown';
  email?: string;
  subscribedAt?: string;
}

export function NewsletterStatusBadge() {
  const [status, setStatus] = useState<NewsletterStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/newsletter/status', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching newsletter status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!status || status.status === 'guest' || status.status === 'not_subscribed') {
    return null; // Don't show badge for non-subscribers
  }

  // Determine badge appearance based on status
  const getBadgeConfig = () => {
    switch (status.status) {
      case 'active':
        return {
          icon: <MailCheck className="w-3.5 h-3.5" />,
          text: 'Newsletter Subscriber',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-700 dark:text-green-400',
          borderColor: 'border-green-300 dark:border-green-700',
        };
      case 'pending':
        return {
          icon: <Mail className="w-3.5 h-3.5" />,
          text: 'Pending Verification',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          textColor: 'text-yellow-700 dark:text-yellow-400',
          borderColor: 'border-yellow-300 dark:border-yellow-700',
        };
      case 'unsubscribed':
        return {
          icon: <MailX className="w-3.5 h-3.5" />,
          text: 'Unsubscribed',
          bgColor: 'bg-gray-100 dark:bg-gray-800/30',
          textColor: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-300 dark:border-gray-700',
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();

  if (!config) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} shadow-sm`}
      title={status.email ? `Subscribed with: ${status.email}` : undefined}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
