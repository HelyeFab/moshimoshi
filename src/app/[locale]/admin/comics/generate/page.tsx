'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { motion } from 'framer-motion'
import { UserGroupIcon } from '@heroicons/react/24/outline'
import Dropdown from '@/components/ui/Dropdown'
import { EPISODE_THEMES, COMIC_CHARACTERS, JLPTLevel } from '@/types/comic'

const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

interface GenerationProgress {
  step: string
  message: string
  progress: number
  currentPanel?: number
  totalPanels?: number
}

export default function GenerateComicPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()

  // Form state
  const [selectedTheme, setSelectedTheme] = useState<string>('')
  const [customTheme, setCustomTheme] = useState<string>('')
  const [customLocation, setCustomLocation] = useState<string>('')
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(['moshi-master'])
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5')
  const [panelCount, setPanelCount] = useState<number>(6)
  const [generateImages, setGenerateImages] = useState<boolean>(true)
  const [generateAudio, setGenerateAudio] = useState<boolean>(true)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [currentStep, setCurrentStep] = useState<'setup' | 'generating' | 'complete'>('setup')

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  // Get theme details when selected
  const selectedThemeData = EPISODE_THEMES.find(t => t.theme === selectedTheme)

  // Auto-select default characters when theme changes
  useEffect(() => {
    if (selectedThemeData && selectedTheme !== 'custom') {
      setSelectedCharacters([...selectedThemeData.characters])
    }
  }, [selectedTheme, selectedThemeData])

  // Toggle character selection
  const toggleCharacter = (characterId: string) => {
    // Moshi must always be selected
    if (characterId === 'moshi-master') return

    setSelectedCharacters(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    )
  }

  const getSelectedThemeData = () => {
    if (selectedTheme === 'custom') {
      return { theme: customTheme, location: customLocation, characters: selectedCharacters }
    }
    const found = EPISODE_THEMES.find(t => t.theme === selectedTheme)
    return found ? { theme: found.theme, location: found.location, characters: selectedCharacters } : null
  }

  const handleGenerate = async () => {
    const themeData = getSelectedThemeData()
    if (!themeData || !themeData.theme) {
      showToast('Please select or enter a theme', 'error')
      return
    }

    setIsGenerating(true)
    setCurrentStep('generating')

    try {
      // Step 1: Generate Outline
      setGenerationProgress({
        step: 'outline',
        message: 'Creating episode outline...',
        progress: 5,
      })

      const outlineResponse = await fetch('/api/admin/comics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 'outline',
          seriesId: 'moshi-goes-to-japan',
          theme: themeData.theme,
          location: themeData.location,
          jlptLevel,
          characterIds: selectedCharacters,
        }),
      })

      if (!outlineResponse.ok) {
        const error = await outlineResponse.json()
        throw new Error(error.error || 'Failed to generate outline')
      }

      const outlineData = await outlineResponse.json()
      const draftId = outlineData.draftId
      const totalPanels = outlineData.panelCount || panelCount

      // Step 2: Generate Dialogues
      setGenerationProgress({
        step: 'dialogues',
        message: 'Writing dialogues...',
        progress: 15,
      })

      const dialogueResponse = await fetch('/api/admin/comics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 'dialogues',
          draftId,
        }),
      })

      if (!dialogueResponse.ok) {
        console.error('Dialogue generation failed')
      }

      // Step 3: Generate Panel Images (if enabled)
      if (generateImages) {
        for (let panelNum = 1; panelNum <= totalPanels; panelNum++) {
          setGenerationProgress({
            step: 'images',
            message: `Generating panel ${panelNum} of ${totalPanels}...`,
            progress: 15 + (panelNum / totalPanels) * 50,
            currentPanel: panelNum,
            totalPanels,
          })

          try {
            const imageResponse = await fetch('/api/admin/comics/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                step: 'panel_image',
                draftId,
                panelNumber: panelNum,
              }),
            })

            if (!imageResponse.ok) {
              console.error(`Image generation failed for panel ${panelNum}`)
            }
          } catch (imgError) {
            console.error(`Error generating panel ${panelNum}:`, imgError)
          }
        }
      }

      // Step 4: Extract Vocabulary
      setGenerationProgress({
        step: 'vocabulary',
        message: 'Extracting vocabulary...',
        progress: 70,
      })

      try {
        await fetch('/api/admin/comics/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            step: 'vocabulary',
            draftId,
          }),
        })
      } catch (vocabError) {
        console.error('Vocabulary extraction failed:', vocabError)
      }

      // Step 5: Generate Cultural Notes
      setGenerationProgress({
        step: 'cultural_notes',
        message: 'Adding cultural notes...',
        progress: 80,
      })

      try {
        await fetch('/api/admin/comics/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            step: 'cultural_notes',
            draftId,
            location: themeData.location,
          }),
        })
      } catch (cultureError) {
        console.error('Cultural notes failed:', cultureError)
      }

      // Step 6: Generate Quiz
      setGenerationProgress({
        step: 'quiz',
        message: 'Creating quiz questions...',
        progress: 85,
      })

      try {
        await fetch('/api/admin/comics/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            step: 'quiz',
            draftId,
          }),
        })
      } catch (quizError) {
        console.error('Quiz generation failed:', quizError)
      }

      // Step 7: Generate Audio (if enabled)
      if (generateAudio) {
        setGenerationProgress({
          step: 'audio',
          message: 'Generating audio...',
          progress: 90,
        })

        try {
          await fetch('/api/admin/comics/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              step: 'audio',
              draftId,
            }),
          })
        } catch (audioError) {
          console.error('Audio generation failed:', audioError)
        }
      }

      // Step 8: Publish
      setGenerationProgress({
        step: 'publish',
        message: 'Publishing episode...',
        progress: 95,
      })

      const publishResponse = await fetch('/api/admin/comics/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draftId }),
      })

      if (!publishResponse.ok) {
        throw new Error('Failed to publish episode')
      }

      setGenerationProgress({
        step: 'complete',
        message: 'Episode created successfully!',
        progress: 100,
      })

      setCurrentStep('complete')
      showToast('Comic episode generated and published!', 'success')

      // Redirect after delay
      setTimeout(() => {
        router.push('/admin/comics')
      }, 2000)

    } catch (error) {
      console.error('Comic generation error:', error)
      showToast(error instanceof Error ? error.message : 'Failed to generate comic', 'error')
      setCurrentStep('setup')
    } finally {
      setIsGenerating(false)
    }
  }

  if (sessionLoading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Generate Moshi Comic Episode
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Create a new episode for &quot;Moshi Goes to Japan&quot;
        </p>

        {/* Setup Form */}
        {currentStep === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6"
          >
            {/* Theme Selection */}
            <div>
              <Dropdown
                label="Episode Theme & Location"
                value={selectedTheme}
                onChange={(value) => setSelectedTheme(value)}
                placeholder="Select a theme..."
                options={[
                  { value: 'custom', label: 'Custom Theme...' },
                  ...EPISODE_THEMES.map(t => ({
                    value: t.theme,
                    label: `${t.titleEn} - ${t.location}`
                  }))
                ]}
              />

              {selectedTheme === 'custom' && (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={customTheme}
                    onChange={e => setCustomTheme(e.target.value)}
                    placeholder="Theme (e.g., 'sushi', 'school')"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    placeholder="Location (e.g., 'Tokyo', 'Kyoto')"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}
              {selectedThemeData && selectedTheme !== 'custom' && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedThemeData.titleJa}
                </p>
              )}
            </div>

            {/* Character Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <UserGroupIcon className="w-4 h-4 inline mr-1" />
                Characters
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMIC_CHARACTERS.map(char => (
                  <label
                    key={char.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCharacters.includes(char.id)
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${char.id === 'moshi-master' ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCharacters.includes(char.id)}
                      onChange={() => toggleCharacter(char.id)}
                      disabled={char.id === 'moshi-master'}
                      className="rounded border-gray-300 dark:border-gray-600 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {char.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {char.nameJa} • {char.role}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Moshi is always included. Select additional characters for the episode.
              </p>
            </div>

            {/* JLPT Level */}
            <div>
              <Dropdown
                label="JLPT Level"
                value={jlptLevel}
                onChange={(value) => setJlptLevel(value as JLPTLevel)}
                options={[
                  { value: 'N5', label: 'N5 (Beginner)' },
                  { value: 'N4', label: 'N4 (Elementary)' },
                  { value: 'N3', label: 'N3 (Intermediate)' },
                  { value: 'N2', label: 'N2 (Pre-Advanced)' },
                  { value: 'N1', label: 'N1 (Advanced)' },
                ]}
              />
            </div>

            {/* Panel Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Panels
              </label>
              <input
                type="number"
                min="4"
                max="10"
                value={panelCount}
                onChange={e => setPanelCount(Math.min(10, Math.max(4, parseInt(e.target.value) || 6)))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Recommended: 6 panels per episode (4-10 allowed)
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generateImages}
                  onChange={e => setGenerateImages(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-rose-500 focus:ring-rose-500 mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Generate panel images (requires Gemini API)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={e => setGenerateAudio(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-rose-500 focus:ring-rose-500 mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Generate dialogue audio (TTS)
                </span>
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedTheme || (selectedTheme === 'custom' && !customTheme)}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>🦝</span>
              Generate Episode
            </button>
          </motion.div>
        )}

        {/* Generation Progress */}
        {currentStep === 'generating' && generationProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-dark-700"
          >
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🦝</span> Generating Episode...
              </h2>

              <p className="text-gray-600 dark:text-gray-400">{generationProgress.message}</p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <motion.div
                  className="bg-gradient-to-r from-rose-500 to-orange-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${generationProgress.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Panel Progress */}
              {generationProgress.currentPanel && generationProgress.totalPanels && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Panel {generationProgress.currentPanel} / {generationProgress.totalPanels}
                </p>
              )}

              {/* Loading Animation */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Complete State */}
        {currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-850 rounded-lg p-8 shadow-lg border border-green-200 dark:border-green-800 text-center"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Episode Created!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Moshi&apos;s new adventure has been published.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Redirecting to comics list...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
