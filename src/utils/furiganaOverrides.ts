import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'moshimoshi-furigana-overrides'
const DB_VERSION = 1
const STORE_NAME = 'sentence_overrides'

interface FuriganaOverrideRecord {
  key: string
  contextKey: string
  sentence: string
  overrides: Record<number, string>
  updatedAt: string
}

interface FuriganaOverridesDB extends DBSchema {
  sentence_overrides: {
    key: string
    value: FuriganaOverrideRecord
    indexes: { 'by-context': string }
  }
}

let cachedDb: IDBPDatabase<FuriganaOverridesDB> | null = null

function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) + hash + input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

function buildKey(contextKey: string, sentence: string): string {
  return `${contextKey}:${hashString(sentence)}`
}

async function getDb(): Promise<IDBPDatabase<FuriganaOverridesDB> | null> {
  if (typeof window === 'undefined') return null
  if (cachedDb) return cachedDb

  try {
    cachedDb = await openDB<FuriganaOverridesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('by-context', 'contextKey')
      },
    })
    return cachedDb
  } catch (error) {
    console.error('[FuriganaOverrides] Failed to open IndexedDB:', error)
    return null
  }
}

export async function getSentenceOverride(
  contextKey: string,
  sentence: string
): Promise<FuriganaOverrideRecord | null> {
  const db = await getDb()
  if (!db) return null

  try {
    const key = buildKey(contextKey, sentence)
    return (await db.get(STORE_NAME, key)) || null
  } catch (error) {
    console.error('[FuriganaOverrides] Failed to read override:', error)
    return null
  }
}

export async function setSentenceOverride(
  contextKey: string,
  sentence: string,
  overrides: Record<number, string>
): Promise<void> {
  const db = await getDb()
  if (!db) return

  const key = buildKey(contextKey, sentence)

  try {
    if (!overrides || Object.keys(overrides).length === 0) {
      await db.delete(STORE_NAME, key)
      return
    }

    const record: FuriganaOverrideRecord = {
      key,
      contextKey,
      sentence,
      overrides,
      updatedAt: new Date().toISOString(),
    }
    await db.put(STORE_NAME, record)
  } catch (error) {
    console.error('[FuriganaOverrides] Failed to save override:', error)
  }
}
