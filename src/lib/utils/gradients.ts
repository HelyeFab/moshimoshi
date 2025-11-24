/**
 * Beautiful gradient combinations for book covers
 */

export const BOOK_GRADIENTS = [
  // Warm & Inviting
  'from-rose-400 via-pink-500 to-purple-600',
  'from-orange-400 via-red-500 to-pink-600',
  'from-amber-400 via-orange-500 to-red-600',

  // Cool & Calm
  'from-blue-400 via-cyan-500 to-teal-600',
  'from-indigo-400 via-blue-500 to-cyan-600',
  'from-teal-400 via-green-500 to-emerald-600',

  // Sunset & Nature
  'from-yellow-400 via-orange-500 to-red-600',
  'from-green-400 via-teal-500 to-blue-600',
  'from-purple-400 via-pink-500 to-red-600',

  // Vibrant & Energetic
  'from-fuchsia-400 via-purple-500 to-indigo-600',
  'from-lime-400 via-green-500 to-teal-600',
  'from-sky-400 via-blue-500 to-indigo-600',

  // Elegant & Sophisticated
  'from-violet-400 via-purple-500 to-indigo-600',
  'from-rose-400 via-red-500 to-orange-600',
  'from-cyan-400 via-blue-500 to-purple-600',

  // Japanese-inspired
  'from-pink-300 via-rose-400 to-red-500', // Sakura
  'from-blue-300 via-sky-400 to-cyan-500', // Sky/Water
  'from-red-400 via-orange-500 to-amber-600', // Autumn
  'from-green-300 via-emerald-400 to-teal-500', // Forest
  'from-indigo-300 via-purple-400 to-violet-500', // Wisteria
];

/**
 * Get a consistent gradient for a given string (like book ID)
 * This ensures the same book always gets the same gradient
 */
export function getGradientForBook(bookId: string): string {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    const char = bookId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % BOOK_GRADIENTS.length;
  return BOOK_GRADIENTS[index];
}

/**
 * Get a random gradient (for new books without ID yet)
 */
export function getRandomGradient(): string {
  const index = Math.floor(Math.random() * BOOK_GRADIENTS.length);
  return BOOK_GRADIENTS[index];
}
