'use client';

import { useState, FormEvent } from 'react';
import { subscribeToNewsletter, isValidEmail } from '@/services/newsletterService';

interface NewsletterFormProps {
  source?: 'blog' | 'homepage' | 'popup';
  className?: string;
}

export function NewsletterForm({ source = 'blog', className = '' }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Reset state
    setStatus('idle');
    setMessage('');

    // Validate email
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    // Submit
    setStatus('loading');

    const result = await subscribeToNewsletter(email, source);

    if (result.success) {
      setStatus('success');
      setMessage(result.message);
      setEmail(''); // Clear form on success
    } else {
      setStatus('error');
      setMessage(result.message);
    }

    // Clear message after 5 seconds
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 5000);
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={status === 'loading' || status === 'success'}
          className={`flex-1 px-6 py-4 rounded-full border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
            status === 'error'
              ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20'
              : status === 'success'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-surface-dark focus:ring-primary-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Email address"
          aria-invalid={status === 'error'}
          aria-describedby={message ? 'newsletter-message' : undefined}
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="px-8 py-4 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Subscribe to newsletter"
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Subscribing...
            </span>
          ) : status === 'success' ? (
            <span className="flex items-center gap-2">
              ✓ Subscribed!
            </span>
          ) : (
            'Subscribe'
          )}
        </button>
      </form>

      {/* Message Display */}
      {message && (
        <div
          id="newsletter-message"
          className={`mt-4 text-center text-sm font-medium animate-fade-in ${
            status === 'error'
              ? 'text-red-600 dark:text-red-400'
              : status === 'success'
              ? 'text-green-600 dark:text-green-400'
              : ''
          }`}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
}
