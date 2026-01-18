import { GrammarPointIndex } from '@/lib/grammar/types';
import { GrammarPointCard } from './GrammarPointCard';

interface GrammarPointGridProps {
  points: GrammarPointIndex[];
  locale: string;
}

export function GrammarPointGrid({ points, locale }: GrammarPointGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {points.map((point) => (
        <GrammarPointCard key={point.id} point={point} locale={locale} />
      ))}
    </div>
  );
}
