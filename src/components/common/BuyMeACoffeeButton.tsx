'use client';

import React, { useState } from 'react';
import { Coffee } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { getDonationAmounts, DONATION_CONFIG } from '@/config/donations';
import { useI18n } from '@/i18n/I18nContext';

interface BuyMeACoffeeButtonProps {
  variant?: 'inline' | 'floating';
  className?: string;
}

export default function BuyMeACoffeeButton({ variant = 'inline', className = '' }: BuyMeACoffeeButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { strings } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [showAmountSelector, setShowAmountSelector] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Get donation amounts from config
  const donationAmounts = getDonationAmounts();
  const defaultAmount = donationAmounts[1]?.value || 500; // Default to middle option
  const [selectedAmount, setSelectedAmount] = useState<number>(defaultAmount);

  const handleDonation = async (amount?: number) => {
    const finalAmount = amount || selectedAmount;

    // Validate custom amount if provided
    if (!finalAmount || finalAmount < DONATION_CONFIG.minimumAmount) {
      showToast(`Minimum donation is ${DONATION_CONFIG.currencySymbol}${DONATION_CONFIG.minimumAmount / 100}`, 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Create a one-time payment session via Stripe
      const response = await fetch('/api/stripe/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          userId: user?.uid,
          userEmail: user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create donation session');
      }

      const { sessionUrl } = await response.json();

      if (sessionUrl) {
        // Redirect to Stripe Checkout
        window.location.href = sessionUrl;
      }
    } catch (error) {
      console.error('Donation error:', error);
      showToast('Unable to process donation. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAmount = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 1) {
      showToast('Please enter a valid amount (minimum $1)', 'error');
      return;
    }
    handleDonation(Math.round(amount * 100)); // Convert to cents
  };

  if (variant === 'floating') {
    return (
      <>
        {/* Floating button with Doshi-inspired colors (red panda theme) - Desktop: rectangular, Mobile: pill */}
        <button
          onClick={() => setShowAmountSelector(!showAmountSelector)}
          disabled={isLoading}
          className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-full sm:rounded-xl ${className}`}
        >
          <Coffee className="w-5 h-5" />
          <span className="hidden sm:inline">{strings.dashboard?.buyMeACoffee || 'Buy me a coffee'}</span>
        </button>

        {/* Amount selector popup - Enhanced design */}
        {showAmountSelector && (
          <div className="fixed bottom-20 right-4 z-50 bg-gradient-to-br from-white to-gray-50 dark:from-dark-800 dark:to-dark-850 rounded-2xl shadow-2xl p-5 w-[280px] border border-gray-100 dark:border-dark-600 transform transition-all duration-300 animate-slide-up">
            {/* Header with icon */}
            <div className="flex items-center gap-2 mb-4">
              <Coffee className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Support with a coffee</h3>
            </div>

            {/* Amount buttons - horizontal for 3 options */}
            <div className="flex gap-2 mb-3">
              {donationAmounts.map((item) => {
                const coffeeCount = item.value <= 500 ? '☕' : item.value <= 1000 ? '☕☕' : '☕☕☕';
                return (
                  <button
                    key={item.value}
                    onClick={() => handleDonation(item.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-dark-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 dark:hover:from-orange-900/20 dark:hover:to-orange-800/20 rounded-xl border border-gray-200 dark:border-dark-600 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                        {item.label}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">{coffeeCount}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom amount with better design */}
            <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl">
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Custom amount</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-7 pr-2 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>
                <button
                  onClick={handleCustomAmount}
                  disabled={isLoading || !customAmount}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline variant for menu - simple dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setShowAmountSelector(!showAmountSelector)}
        disabled={isLoading}
        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-dark-700 transition-colors ${className}`}
      >
        <Coffee className="w-4 h-4" />
        <span>{strings.dashboard?.buyMeACoffee || 'Buy me a coffee'}</span>
      </button>

      {/* Dropdown modal */}
      {showAmountSelector && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowAmountSelector(false)}
          />

          {/* Dropdown - using menu theme */}
          <div className="absolute right-0 mt-2 z-50 bg-soft-white dark:bg-dark-800 rounded-lg shadow-lg p-4 w-[240px] border border-gray-200 dark:border-dark-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Choose an amount:</h3>

            {/* Amount buttons */}
            <div className="space-y-1">
              {donationAmounts.map((item) => (
                <button
                  key={item.value}
                  onClick={() => handleDonation(item.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-left rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Custom amount</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="$"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="flex-1 w-0 px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300"
                />
                <button
                  onClick={handleCustomAmount}
                  disabled={isLoading || !customAmount}
                  className="px-3 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}