export function buildDeckPrefix(userId: string, deckId: string): string {
  return `users/${userId}/decks/${deckId}/`
}

export function isValidDeckKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  if (key.includes('\\')) return false
  return true
}
