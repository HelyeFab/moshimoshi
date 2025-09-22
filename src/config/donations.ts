/**
 * Donation configuration - centralized settings for Buy Me a Coffee feature
 */

import donationAmountsConfig from './donation-amounts.json';

export interface DonationAmount {
  label: string;
  value: number; // Amount in cents for Stripe
  description?: string;
}

export const DONATION_CONFIG = {
  currency: process.env.NEXT_PUBLIC_DONATION_CURRENCY || 'usd',
  currencySymbol: process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'GBP' ? '£' :
                  process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'EUR' ? '€' : '$',
  minimumAmount: 100, // Minimum $1.00 in cents
};

// Load donation amounts from JSON config
export const getDonationAmounts = (): DonationAmount[] => {
  return donationAmountsConfig.amounts.map(amount => ({
    label: amount.label || `${DONATION_CONFIG.currencySymbol}${amount.value}`,
    value: amount.value * 100, // Convert dollars to cents for Stripe
    description: '' // No descriptions needed
  }));
};