export interface TatoebaSentence {
  japanese: string
  english: string
  id?: string
  furigana?: string // We'll add furigana on the client side
}

export async function fetchTatoebaSentences(kanji: string, limit: number = 2): Promise<TatoebaSentence[]> {
  try {
    const response = await fetch(`/api/tatoeba/search?kanji=${encodeURIComponent(kanji)}&limit=${limit}`)

    if (!response.ok) {
      console.error('Failed to fetch Tatoeba sentences:', response.statusText)
      return []
    }

    const data = await response.json()
    return data.sentences || []
  } catch (error) {
    console.error('Error fetching Tatoeba sentences:', error)
    return []
  }
}