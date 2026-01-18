import { Example } from '@/lib/grammar/types';
import FuriganaText from './FuriganaText';

interface ExampleSentenceProps {
  example: Example;
  index: number;
  showFurigana: boolean;
  labels: {
    example: string;
    breakdown: string;
    note: string;
  };
}

type BreakdownEntry = { word: string; meaning: string };

export function ExampleSentence({ example, index, showFurigana, labels }: ExampleSentenceProps) {
  const breakdownEntries: BreakdownEntry[] = (() => {
    const breakdown: unknown = example.breakdown;
    if (!breakdown) return [];
    if (typeof breakdown === 'object' && breakdown && Array.isArray((breakdown as { elements?: unknown }).elements)) {
      return (breakdown as { elements: Array<{ token?: unknown; gloss?: unknown }> }).elements
        .map((item) => ({
          word: String(item?.token ?? '').trim(),
          meaning: String(item?.gloss ?? '').trim(),
        }))
        .filter((item) => item.word || item.meaning);
    }
    if (typeof breakdown !== 'object' || !breakdown) return [];
    return Object.entries(breakdown as Record<string, unknown>).flatMap(([word, meaning]) => {
      if (typeof meaning === 'string') {
        return [{ word, meaning }];
      }
      if (meaning && typeof meaning === 'object') {
        const token = (meaning as { token?: unknown }).token ?? word;
        const gloss =
          (meaning as { gloss?: unknown; meaning?: unknown }).gloss ??
          (meaning as { meaning?: unknown }).meaning ??
          '';
        return [{ word: String(token), meaning: String(gloss) }];
      }
      return [];
    });
  })();

  return (
    <div className="border-l-4 border-primary-500 pl-4">
      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
        {labels.example} {index}
      </div>

      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        <FuriganaText text={example.japanese} showFurigana={showFurigana} />
      </div>

      <div className="text-lg text-gray-600 dark:text-gray-400 mb-2">
        {example.romaji}
      </div>

      <div className="text-lg text-gray-800 dark:text-gray-200 font-medium mb-3">
        {example.english}
      </div>

      <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          {labels.breakdown}
        </div>
        {breakdownEntries.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">—</div>
        ) : (
          breakdownEntries.map((entry: BreakdownEntry, idx) => (
            <div key={`${entry.word}-${idx}`} className="flex items-start text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100 min-w-[80px]">
                {entry.word}
              </span>
              <span className="text-gray-600 dark:text-gray-300">{entry.meaning}</span>
            </div>
          ))
        )}
      </div>

      {example.notes && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
          {labels.note}: {example.notes}
        </div>
      )}
    </div>
  );
}
