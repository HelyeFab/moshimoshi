'use client';

import React, { useState } from 'react';
import { Coffee } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { getDonationAmounts, DONATION_CONFIG } from '@/config/donations';

interface BuyMeACoffeeButtonProps {
  variant?: 'inline' | 'floating';
  className?: string;
}

export default function BuyMeACoffeeButton({ variant = 'inline', className = '' }: BuyMeACoffeeButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
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
          <span className="hidden sm:inline">Buy me a coffee</span>
        </button>

        {/* Amount selector popup */}
        {showAmountSelector && (
          <div className="fixed bottom-20 right-4 z-50 bg-white dark:bg-dark-800 rounded-lg shadow-xl p-4 min-w-[200px] border border-gray-200 dark:border-dark-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Choose an amount:</h3>
            <div className="space-y-2">
              {donationAmounts.map((item) => (
                <button
                  key={item.value}
                  onClick={() => handleDonation(item.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-left rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors flex justify-between items-center"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{item.description}</span>
                </button>
              ))}

              {/* Custom amount */}
              <div className="pt-2 border-t border-gray-200 dark:border-dark-700">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Custom $"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300"
                  />
                  <button
                    onClick={handleCustomAmount}
                    disabled={isLoading || !customAmount}
                    className="px-3 py-1 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    Give
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline variant for menu - styled as a subtle footer
  return (
    <div className={`w-full ${className}`}>
      <div className="p-3 space-y-3">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Support the development</p>
          <div className="flex justify-center gap-2">
            {donationAmounts.map((item) => (
              <button
                key={item.value}
                onClick={() => handleDonation(item.value)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowAmountSelector(!showAmountSelector)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Buy me a coffee</span>
        </button>

        {/* Custom amount input for inline */}
        {showAmountSelector && (
          <div className="flex gap-2 px-2">
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Custom $"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={handleCustomAmount}
              disabled={isLoading || !customAmount}
              className="px-3 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors disabled:opacity-50"
            >
              Give
            </button>
          </div>
        )}
      </div>
    </div>
  );
}