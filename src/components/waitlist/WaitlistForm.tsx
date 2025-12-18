'use client';

import { useState, FormEvent } from 'react';
import { useTranslation } from '@/i18n/I18nContext';
import { strings as enStrings } from '@/i18n/locales/en/strings';
import { useReCaptcha } from '@/components/ReCaptchaProvider';

interface WaitlistFormProps {
  className?: string;
  onSuccess?: () => void;
}

export function WaitlistForm({ className = '', onSuccess }: WaitlistFormProps) {
  const { strings } = useTranslation();
  const { executeRecaptcha } = useReCaptcha();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Use waitlist form strings with fallback
  const t = strings?.waitlist?.form || enStrings.waitlist?.form;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Reset state
    setStatus('idle');
    setMessage('');

    // Validate email (basic)
    if (!email.trim()) {
      setStatus('error');
      setMessage(t?.errors?.required || 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setMessage(t?.errors?.invalid || 'Please enter a valid email address');
      return;
    }

    // Submit to API
    setStatus('loading');

    try {
      // Execute reCAPTCHA
      const recaptchaToken = await executeRecaptcha('waitlist');

      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, recaptchaToken }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(t?.success?.message || data.message);
        setEmail('');
        onSuccess?.();
      } else {
        setStatus('error');
        setMessage(data.error?.message || t?.errors?.generic || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage(t?.errors?.network || 'Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t?.placeholder || 'Enter your email'}
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
          aria-describedby={message ? 'waitlist-message' : undefined}
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="px-8 py-4 bg-gradient-to-r from-primary-500 to-japanese-sakura text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
          aria-label="Join waitlist"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t?.button?.loading || 'Joining...'}
            </span>
          ) : status === 'success' ? (
            <span className="flex items-center justify-center gap-2">
              ✓ {t?.button?.success || "You're In!"}
            </span>
          ) : (
            t?.button?.default || 'Join Waitlist'
          )}
        </button>
      </form>

      {/* Message Display */}
      {message && (
        <div
          id="waitlist-message"
          className={`mt-4 text-center text-sm sm:text-base font-medium animate-fade-in ${
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

      {/* Success State - Additional Info */}
      {status === 'success' && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">
                {t?.success?.title || "You're on the list!"}
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {t?.success?.description || "When we launch, you can use the app completely free. If you decide to upgrade to Premium for extra features, you'll automatically get 25% off!"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
