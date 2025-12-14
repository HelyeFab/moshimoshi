export type SessionPayload = {
  id: string
  userId: string
  deckId: string
  deckName: string
  timestamp: number
  duration: number
  cardsStudied: number
  cardsCorrect: number
  cardsIncorrect: number
  cardsSkipped: number
  accuracy: number
  newCards: number
  learningCards: number
  reviewCards: number
  averageResponseTime: number
  fastestResponseTime: number
  slowestResponseTime: number
  xpEarned?: number
  streakSnapshot?: number
  perfectSession?: boolean
  mode?: string
  settings?: {
    sessionLength: number
    reviewMode: string
  }
}

function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function validateSessionPayload(body: any): SessionPayload | null {
  const requiredNumberFields: Array<keyof SessionPayload> = [
    'timestamp',
    'duration',
    'cardsStudied',
    'cardsCorrect',
    'cardsIncorrect',
    'cardsSkipped',
    'accuracy',
    'newCards',
    'learningCards',
    'reviewCards',
    'averageResponseTime',
    'fastestResponseTime',
    'slowestResponseTime',
  ]

  if (!body || typeof body !== 'object') return null
  const requiredStrings: Array<keyof SessionPayload> = ['id', 'userId', 'deckId', 'deckName']
  if (!requiredStrings.every(field => typeof body[field] === 'string')) return null
  if (!requiredNumberFields.every(field => isValidNumber(body[field]))) return null

  return body as SessionPayload
}
