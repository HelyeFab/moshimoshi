'use client'

import { useState, useEffect } from 'react'
import {
  PlayIcon,
  BookOpenIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  NewspaperIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline'

interface CarouselSlide {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

interface HeroCarouselProps {
  slides: CarouselSlide[]
}

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Carousel Container */}
      <div className="overflow-hidden rounded-2xl bg-white/10 dark:bg-black/10 backdrop-blur-sm p-8 shadow-2xl">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
            }`}
          >
            <div className={`flex flex-col items-center text-center space-y-4 bg-gradient-to-br ${slide.color} p-6 rounded-xl`}>
              <div className="text-white">
                {slide.icon}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {slide.title}
              </h3>
              <p className="text-white/90 text-lg">
                {slide.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Carousel Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-8 bg-white'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
