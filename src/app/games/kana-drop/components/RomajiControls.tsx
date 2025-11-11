'use client';

import { motion } from 'framer-motion';
import { KanaChar } from '../types';

interface RomajiControlsProps {
  selectedKana: KanaChar[];
  activeRomaji: string | null;
  onRomajiClick: (romaji: string) => void;
  disabled: boolean;
}

export default function RomajiControls({
  selectedKana,
  activeRomaji,
  onRomajiClick,
  disabled
}: RomajiControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t-2 border-border p-4">
      <div className="flex justify-center items-center gap-3 flex-wrap">
        {selectedKana.map((kana) => (
          <motion.button
            key={kana.id}
            onClick={() => !disabled && onRomajiClick(kana.romaji)}
            disabled={disabled}
            className={`
              relative px-6 py-3 rounded-lg font-semibold text-lg transition-all
              ${activeRomaji === kana.romaji
                ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                : 'bg-card text-card-foreground border-2 border-border hover:border-primary/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
          >
            {/* Active indicator glow */}
            {activeRomaji === kana.romaji && (
              <motion.div
                className="absolute inset-0 rounded-lg bg-primary/30"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            
            <span className="relative z-10">{kana.romaji}</span>
            
            {/* Small kana preview */}
            <span className="absolute -top-2 -right-2 text-xs bg-background border border-border rounded px-1 japanese-text">
              {kana.kana}
            </span>
          </motion.button>
        ))}
      </div>
      
      {!activeRomaji && !disabled && (
        <div className="text-center mt-2 text-sm text-muted-foreground animate-pulse">
          Click a button to start catching kana!
        </div>
      )}
    </div>
  );
}