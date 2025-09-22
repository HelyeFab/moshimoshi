'use client'

import { useState, useEffect, useRef } from 'react'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { motion } from 'framer-motion'

interface SpeechInputProps {
  content: ReviewableContent
  onAnswer: (answer: string, confidence?: number) => void
  disabled: boolean
  showAnswer: boolean
}

export default function SpeechInput({
  content,
  onAnswer,
  disabled,
  showAnswer
}: SpeechInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  
  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }
    
    // Initialize speech recognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'ja-JP' // Japanese
    
    recognition.onresult = (event: any) => {
      const current = event.resultIndex
      const transcript = event.results[current][0].transcript
      setTranscript(transcript)
      
      if (event.results[current].isFinal) {
        handleTranscript(transcript, event.results[current][0].confidence)
      }
    }
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
    }
    
    recognition.onend = () => {
      setIsRecording(false)
    }
    
    recognitionRef.current = recognition
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [content])
  
  const startRecording = () => {
    if (!isSupported || disabled || !recognitionRef.current) return
    
    setTranscript('')
    setIsRecording(true)
    recognitionRef.current.start()
  }
  
  const stopRecording = () => {
    if (!recognitionRef.current) return
    
    recognitionRef.current.stop()
    setIsRecording(false)
  }
  
  const handleTranscript = (text: string, confidence: number) => {
    if (text.trim()) {
      onAnswer(text.trim(), confidence)
    }
  }
  
  if (!isSupported) {
    return (
      <div className="mt-8 max-w-lg mx-auto">
        <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-yellow-800 dark:text-yellow-200">
            Speech recognition is not supported in your browser.
            Please use Chrome, Edge, or Safari.
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-8 max-w-lg mx-auto">
      <div className="space-y-4">
        {/* Recording button */}
        <div className="text-center">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`
              relative p-8 rounded-full transition-all duration-200
              ${isRecording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-primary hover:bg-primary-dark'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span className="text-white text-4xl">
              {isRecording ? '🔴' : '🎤'}
            </span>
            
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-red-300"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </button>
          
          <div className="mt-4 text-lg">
            {isRecording ? 'Listening...' : 'Tap to speak'}
          </div>
        </div>
        
        {/* Transcript display */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
          >
            <div className="text-sm text-gray-500 mb-1">You said:</div>
            <div className="text-lg font-japanese">{transcript}</div>
          </motion.div>
        )}
        
        {/* Tips */}
        {!showAnswer && !isRecording && (
          <div className="text-center text-sm text-gray-500">
            Speak clearly in Japanese. The microphone will stop automatically when you pause.
          </div>
        )}
      </div>
      
      {/* Feedback */}
      {showAnswer && transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center"
        >
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            Expected:
          </div>
          <div className="text-2xl font-japanese">
            {content.primaryDisplay}
          </div>
          <div className="text-lg mt-2">
            {content.primaryAnswer}
          </div>
        </motion.div>
      )}
    </div>
  )
}