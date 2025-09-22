/**
 * Donation configuration - centralized settings for Buy Me a Coffee feature
 */

export interface DonationAmount {
  label: string;
  value: number; // Amount in cents for Stripe
  description: string;
}

export const DONATION_CONFIG = {
  currency: process.env.NEXT_PUBLIC_DONATION_CURRENCY || 'usd',
  currencySymbol: process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'GBP' ? '£' :
                  process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'EUR' ? '€' : '$',
  minimumAmount: 100, // Minimum $1.00 in cents

  // Preset donation amounts
  amounts: [
    {
      label: `${process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'GBP' ? '£' : '$'}3`,
      value: 500,
      description: 'Coffee'
    },
    {
      label: `${process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'GBP' ? '£' : '$'}5`,
      value: 1000,
      description: 'Latte'
    },
    {
      label: `${process.env.NEXT_PUBLIC_DONATION_CURRENCY === 'GBP' ? '£' : '$'}10`,
      value: 2000,
      description: 'Lunch'
    },
  ] as DonationAmount[]
};

// Or load from environment variables if you prefer
export const getDonationAmounts = (): DonationAmount[] => {
  // Could parse from env like: DONATION_AMOUNTS="3:Coffee,5:Latte,10:Lunch"
  const envAmounts = process.env.NEXT_PUBLIC_DONATION_AMOUNTS;

  if (envAmounts) {
    return envAmounts.split(',').map(item => {
      const [amount, description] = item.split(':');
      const value = parseInt(amount) * 100; // Convert to cents
      return {
        label: `${DONATION_CONFIG.currencySymbol}${amount}`,
        value,
        description: description || 'Support'
      };
    });
  }

  return DONATION_CONFIG.amounts;
};