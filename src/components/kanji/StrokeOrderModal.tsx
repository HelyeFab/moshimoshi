'use client'

import Modal from '@/components/ui/Modal'
import StrokeOrderDisplay from './StrokeOrderDisplay'

interface StrokeOrderModalProps {
  character: string
  isOpen: boolean
  onClose: () => void
}

export default function StrokeOrderModal({
  character,
  isOpen,
  onClose
}: StrokeOrderModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stroke Order: ${character}`}
      size="lg"
    >
      <div className="p-6">
        <div className="flex justify-center">
          <StrokeOrderDisplay
            kanji={character}
            size={280}
            autoPlay={false}
            showControls={true}
            strokeSpeed={800}
          />
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-6">
          Use the controls to watch the stroke order animation step by step or play it automatically
        </p>
      </div>
    </Modal>
  )
}