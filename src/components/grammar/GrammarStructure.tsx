import { GrammarPoint } from '@/lib/grammar/types';
import FuriganaText from './FuriganaText';

interface GrammarStructureProps {
  structure: GrammarPoint['structure'];
  showFurigana: boolean;
  labels: {
    pattern: string;
    examples: string;
  };
}

export function GrammarStructure({ structure, showFurigana, labels }: GrammarStructureProps) {
  return (
    <div>
      <div className="bg-white/90 dark:bg-dark-700/70 border border-gray-200 dark:border-dark-600 rounded-lg p-4 mb-4">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          {labels.pattern}
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          <FuriganaText text={structure.pattern} showFurigana={showFurigana} />
        </div>
      </div>

      <div className="space-y-3">
        {structure.components.map((component, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
            <div className="flex items-start mb-2">
              <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-200 font-semibold text-xs mr-3 leading-snug text-center whitespace-pre-line min-w-[2.5rem]">
                <FuriganaText
                  text={component.part}
                  showFurigana={showFurigana}
                  className="leading-snug"
                />
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {component.explanation}
              </span>
            </div>
            <div className="ml-11 text-sm text-gray-600 dark:text-gray-400">
              {labels.examples}:{' '}
              {component.examples.map((example, exampleIndex) => (
                <span key={`${example}-${exampleIndex}`}>
                  <FuriganaText
                    text={example}
                    showFurigana={showFurigana}
                    className="inline"
                  />
                  {exampleIndex < component.examples.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
