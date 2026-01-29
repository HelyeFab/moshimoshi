/**
 * List Adapter for Blast Mode
 * Transforms user list items into BlastItem format
 */

import type { BlastItem } from '../types'
import type { ListItem, UserList } from '@/types/userLists'
import { hasKanji } from '@/types/vocabulary'

export interface ListAdapterConfig {
  list: UserList
  count: number
}

export function listItemToBlastItem(item: ListItem, listType: UserList['type']): BlastItem {
  const content = item.content
  const meaningEn = item.metadata?.meaning || 'Unknown'
  const reading = item.metadata?.reading
  const isSentence = listType === 'sentence'
  const containsKanji = hasKanji(content)

  return {
    id: `list-${item.id}`,
    contentType: isSentence ? 'sentence' : 'list',
    kanji: containsKanji ? content : undefined,
    kana: reading || (!containsKanji ? content : undefined),
    meaningEn,
    readings: undefined,
    tokens: undefined,
    sourceTags: [
      `list-${listType}`
    ]
  }
}

export function listToBlastItems(config: ListAdapterConfig): BlastItem[] {
  const { list, count } = config
  const selected = list.items.slice(0, count)
  return selected.map(item => listItemToBlastItem(item, list.type))
}
