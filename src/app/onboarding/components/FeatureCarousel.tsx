'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { FeatureConfig } from '../config'

interface FeatureCarouselProps {
  features: FeatureConfig[]
  featureStrings: Record<string, { title: string; description: string; highlight?: string }>
}

const swipeConfidenceThreshold = 10000
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.9,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.9,
  }),
}

export function FeatureCarousel({ features, featureStrings }: FeatureCarouselProps) {
  const [[page, direction], setPage] = useState([0, 0])

  const currentIndex = ((page % features.length) + features.length) % features.length
  const currentFeature = features[currentIndex]
  const currentStrings = featureStrings[currentFeature.i18nKey] || {
    title: currentFeature.id,
    description: '',
  }

  const paginate = useCallback(
    (newDirection: number) => {
      setPage([page + newDirection, newDirection])
    },
    [page]
  )

  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
      const swipe = swipePower(offset.x, velocity.x)

      if (swipe < -swipeConfidenceThreshold) {
        paginate(1)
      } else if (swipe > swipeConfidenceThreshold) {
        paginate(-1)
      }
    },
    [paginate]
  )

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Main Carousel Area */}
      <div className="relative h-80 overflow-hidden rounded-2xl">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            className={`absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br ${currentFeature.color} text-white rounded-2xl cursor-grab active:cursor-grabbing`}
          >
            {/* Icon */}
            <div className="mb-6 p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              {currentFeature.icon}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold mb-3 text-center">{currentStrings.title}</h3>

            {/* Description */}
            <p className="text-white/90 text-center text-base leading-relaxed max-w-xs">
              {currentStrings.description}
            </p>

            {/* Highlight badge if available */}
            {currentStrings.highlight && (
              <div className="mt-4 px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                {currentStrings.highlight}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {features.length > 1 && (
          <>
            <button
              onClick={() => paginate(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"
              aria-label="Previous feature"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => paginate(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"
              aria-label="Next feature"
            >
              <ChevronRightIcon className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </div>

      {/* Swipe Hint */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
        Swipe to explore more features
      </p>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => setPage([index, index > currentIndex ? 1 : -1])}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            }`}
            aria-label={`Go to feature ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress Text */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
        {currentIndex + 1} of {features.length}
      </p>
    </div>
  )
}
