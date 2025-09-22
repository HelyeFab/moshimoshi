'use client'

import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { ReviewMode } from '@/lib/review-engine/core/types'
import { motion } from 'framer-motion'
import KanaCard from './cards/KanaCard'
import KanjiCard from './cards/KanjiCard'
import VocabularyCard from './cards/VocabularyCard'
import SentenceCard from './cards/SentenceCard'
import CustomCard from './cards/CustomCard'

interface ReviewCardProps {
  content: ReviewableContent
  mode: ReviewMode
  showAnswer: boolean
  onAudioPlay?: () => void
}

export default function ReviewCard({
  content,
  mode,
  showAnswer,
  onAudioPlay
}: ReviewCardProps) {
  // Render different layouts based on content type
  const renderContent = () => {
    const cardProps = { content, mode, showAnswer, onAudioPlay }
    
    switch (content.contentType) {
      case 'kana':
        return <KanaCard {...cardProps} />
      case 'kanji':
        return <KanjiCard {...cardProps} />
      case 'vocabulary':
        return <VocabularyCard {...cardProps} />
      case 'sentence':
        return <SentenceCard {...cardProps} />
      case 'grammar':
        return <CustomCard {...cardProps} />
      case 'custom':
      default:
        return <CustomCard {...cardProps} />
    }
  }
  
  return (
    <motion.div 
      className="bg-soft-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 min-h-[400px] flex flex-col justify-center"
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {renderContent()}
    </motion.div>
  )
}