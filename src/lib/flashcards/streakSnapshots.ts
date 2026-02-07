import type { FlashcardDeck, FlashcardStreakSnapshot } from '@/types/flashcards'

const pad = (value: number) => String(value).padStart(2, '0')

export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export const getLastNDates = (days: number, endDate: Date = new Date()): string[] => {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    dates.push(getLocalDateKey(date))
  }
  return dates
}

export const buildStreakSnapshot = (
  userId: string,
  decks: FlashcardDeck[],
  date: Date = new Date()
): FlashcardStreakSnapshot => {
  let streak1 = 0
  let streak2 = 0
  let streak3plus = 0

  for (const deck of decks) {
    for (const card of deck.cards) {
      const streak = card.metadata?.streak ?? 0
      if (streak >= 3) {
        streak3plus += 1
      } else if (streak === 2) {
        streak2 += 1
      } else if (streak === 1) {
        streak1 += 1
      }
    }
  }

  const total = streak1 + streak2 + streak3plus
  const dateKey = getLocalDateKey(date)

  return {
    id: `${userId}_${dateKey}`,
    userId,
    date: dateKey,
    streak1,
    streak2,
    streak3plus,
    total,
    updatedAt: Date.now(),
  }
}
