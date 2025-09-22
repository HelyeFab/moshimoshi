'use client'

import { useState, useRef, useEffect } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { motion } from 'framer-motion'

interface WritingInputProps {
  content: ReviewableContent
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function WritingInput({
  content,
  onAnswer,
  disabled,
  showAnswer
}: WritingInputProps) {
  const [strokes, setStrokes] = useState<any[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Set up canvas
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    canvas.style.width = `${canvas.offsetWidth}px`
    canvas.style.height = `${canvas.offsetHeight}px`
    
    const context = canvas.getContext('2d')
    if (!context) return
    
    context.scale(2, 2)
    context.lineCap = 'round'
    context.strokeStyle = 'black'
    context.lineWidth = 3
    contextRef.current = context
    
    // Clear canvas when content changes
    clearCanvas()
  }, [content])
  
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    setIsDrawing(true)
    
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    
    contextRef.current?.beginPath()
    contextRef.current?.moveTo(x, y)
  }
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    
    contextRef.current?.lineTo(x, y)
    contextRef.current?.stroke()
  }
  
  const stopDrawing = () => {
    setIsDrawing(false)
  }
  
  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) return
    
    context.clearRect(0, 0, canvas.width, canvas.height)
    setStrokes([])
  }
  
  const handleSubmit = () => {
    if (disabled) return
    
    // In a real implementation, this would use handwriting recognition
    // For now, just submit a placeholder
    onAnswer('[handwritten]', 0.5)
  }
  
  return (
    <div className="mt-8 max-w-lg mx-auto">
      <div className="space-y-4">
        {/* Canvas */}
        <div className="relative bg-soft-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-64 cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* Grid lines for guidance */}
          <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full">
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="gray" strokeWidth="1" opacity="0.2" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="gray" strokeWidth="1" opacity="0.2" />
            </svg>
          </div>

          {/* Ghost character to trace (for kanji/kana) */}
          {(content.contentType === 'kanji' || content.contentType === 'kana') && content.primaryDisplay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-8xl font-japanese text-gray-200 dark:text-gray-700 select-none">
                {content.primaryDisplay}
              </div>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            disabled={disabled}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Clear
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            data-submit
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            Submit
          </button>
        </div>
        
        {/* Stroke order hint */}
        {content.metadata?.strokeOrderUrl && (
          <button
            type="button"
            className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            Show Stroke Order
          </button>
        )}
      </div>
      
      {/* Feedback */}
      {showAnswer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center"
        >
          <div className="text-gray-600 dark:text-gray-400">
            Correct answer:
          </div>
          <div className="text-6xl font-japanese mt-2">
            {content.primaryDisplay}
          </div>
        </motion.div>
      )}
    </div>
  )
}