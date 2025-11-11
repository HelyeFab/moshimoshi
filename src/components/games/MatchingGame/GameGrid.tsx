'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Tile from './Tile'
import { GameState, GAME_CONFIG } from './types'

interface GameGridProps {
  gameState: GameState
  onTileClick: (tileId: string) => void
  disabled: boolean
}

export default function GameGrid({ gameState, onTileClick, disabled }: GameGridProps) {
  const { tiles } = gameState

  // Calculate grid dimensions based on number of tiles
  const totalTiles = tiles.length
  let cols = GAME_CONFIG.GRID_COLS
  let rows = Math.ceil(totalTiles / cols)

  // Adjust for smaller tile counts
  if (totalTiles <= 20) {
    cols = 5
    rows = 4
  } else if (totalTiles <= 24) {
    cols = 6
    rows = 4
  }

  // Responsive grid classes
  const getGridClassName = () => {
    if (cols === 5) {
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
    } else if (cols === 6) {
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
    }
    return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={`grid gap-4 sm:gap-5 md:gap-6 ${getGridClassName()}`}
      >
        <AnimatePresence>
          {tiles.map((tile) => (
            <motion.div
              key={tile.id}
              layout
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: 0.3,
                delay: tile.position * 0.05
              }}
            >
              <Tile
                tile={tile}
                onClick={onTileClick}
                disabled={disabled}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}