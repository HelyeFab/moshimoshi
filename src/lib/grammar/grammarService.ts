import {
  GrammarCategoryLabelsFile,
  GrammarChaptersFile,
  GrammarIndexFile,
  GrammarPoint,
  GrammarPointsIndexMap,
} from './types';

const isServer = typeof window === 'undefined';
const GRAMMAR_LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;
async function readJson<T>(relativePath: string): Promise<T> {
  if (!isServer) {
    const response = await fetch(`/${relativePath}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${relativePath}`);
    }
    return response.json();
  }

  const [{ readFile }, path] = await Promise.all([
    import('fs/promises'),
    import('path'),
  ]);
  const publicDir = path.join(process.cwd(), 'public');
  const filePath = path.join(publicDir, relativePath);
  const fileContents = await readFile(filePath, 'utf-8');
  return JSON.parse(fileContents) as T;
}

/**
 * Load the full grammar index.
 */
export async function getGrammarIndex(level: string = 'n5'): Promise<GrammarIndexFile> {
  return readJson<GrammarIndexFile>(`data/grammar/${level}-index.json`);
}

/**
 * Load the grammar points index map (pointId -> level).
 */
export async function getGrammarPointsIndex(): Promise<GrammarPointsIndexMap> {
  return readJson<GrammarPointsIndexMap>('data/grammar/points-index.json');
}

/**
 * Load the grammar chapters (JLPT chapter grouping) for a level.
 */
export async function getGrammarChapters(level: string): Promise<GrammarChaptersFile> {
  return readJson<GrammarChaptersFile>(`data/grammar/sections/${level}.json`);
}

/**
 * Load localized labels for grammar categories.
 */
export async function getGrammarCategoryLabels(): Promise<GrammarCategoryLabelsFile> {
  return readJson<GrammarCategoryLabelsFile>('data/grammar/category-labels.json');
}

/**
 * Resolve a grammar point's level using the points index map,
 * with a fallback scan across known level indices.
 */
export async function resolveGrammarPointLevel(pointId: string): Promise<string | null> {
  try {
    const indexMap = await getGrammarPointsIndex();
    const mappedLevel = indexMap?.points?.[pointId];
    if (typeof mappedLevel === 'string') {
      return mappedLevel;
    }
  } catch {
    // Fall through to index scan.
  }

  for (const level of GRAMMAR_LEVELS) {
    try {
      const indexData = await getGrammarIndex(level);
      if (indexData.points.some((point) => point.id === pointId)) {
        return level;
      }
    } catch {
      // Skip missing indexes.
    }
  }

  return null;
}

export function getGrammarLevels(): readonly string[] {
  return GRAMMAR_LEVELS;
}

/**
 * Load a specific grammar point by ID.
 */
export async function getGrammarPoint(
  id: string,
  level: string = 'n5'
): Promise<GrammarPoint> {
  return readJson<GrammarPoint>(`data/grammar/points/${level}/${id}.json`);
}

/**
 * Load multiple grammar points (for related points).
 */
export async function getGrammarPoints(
  ids: string[],
  level: string = 'n5'
): Promise<GrammarPoint[]> {
  const promises = ids.map((id) => getGrammarPoint(id, level));
  return Promise.all(promises);
}
