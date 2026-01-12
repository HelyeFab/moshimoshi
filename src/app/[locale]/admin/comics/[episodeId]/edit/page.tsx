'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { ArrowLeftIcon, SaveIcon } from 'lucide-react'

interface Panel {
  panelNumber: number
  imageUrl?: string
  sceneDescription?: string
  dialogues?: Array<{
    characterId?: string
    characterName?: string
    textJa?: string
    textEn?: string
    furigana?: string
  }>
  narration?: {
    textJa?: string
    textEn?: string
    furigana?: string
  } | null
}

export default function EditComicEpisodePage() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.episodeId as string
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingPanelIndex, setUploadingPanelIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Episode data
  const [title, setTitle] = useState('')
  const [titleJa, setTitleJa] = useState('')
  const [panels, setPanels] = useState<Panel[]>([])
  const [panelOrders, setPanelOrders] = useState<number[]>([])

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  // Load episode data
  useEffect(() => {
    const loadEpisode = async () => {
      if (!episodeId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/admin/comics/episodes?episodeId=${episodeId}`)

        if (!response.ok) {
          throw new Error('Failed to load episode')
        }

        const data = await response.json()
        const episode = data.episodes?.[0]

        if (!episode) {
          throw new Error('Episode not found')
        }

        setTitle(episode.title || '')
        setTitleJa(episode.titleJa || '')
        setPanels(episode.panels || [])
        setPanelOrders((episode.panels || []).map((_: any, i: number) => i + 1))
      } catch (error) {
        console.error('Error loading episode:', error)
        showToast('Failed to load episode', 'error')
        router.push('/admin/comics')
      } finally {
        setLoading(false)
      }
    }

    if (user?.isAdmin) {
      loadEpisode()
    }
  }, [episodeId, user, router, showToast])

  const updatePanelDialogue = (panelIndex: number, dialogueIndex: number, field: string, value: string) => {
    setPanels(prev => {
      const next = [...prev]
      const panel = { ...next[panelIndex] }
      const dialogues = [...(panel.dialogues || [])]
      dialogues[dialogueIndex] = { ...dialogues[dialogueIndex], [field]: value }
      panel.dialogues = dialogues
      next[panelIndex] = panel
      return next
    })
  }

  const updatePanelNarration = (panelIndex: number, field: string, value: string) => {
    setPanels(prev => {
      const next = [...prev]
      const panel = { ...next[panelIndex] }
      const narration = panel.narration ? { ...panel.narration } : { textJa: '', textEn: '', furigana: '' }
      narration[field as keyof typeof narration] = value
      panel.narration = narration
      next[panelIndex] = panel
      return next
    })
  }

  const togglePanelNarration = (panelIndex: number) => {
    setPanels(prev => {
      const next = [...prev]
      const panel = { ...next[panelIndex] }
      panel.narration = panel.narration ? null : { textJa: '', textEn: '', furigana: '' }
      next[panelIndex] = panel
      return next
    })
  }

  const handlePanelImageUpload = async (panelIndex: number, file: File) => {
    try {
      setUploadError(null)
      setUploadingPanelIndex(panelIndex)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok || !result?.url) {
        throw new Error(result?.error || 'Image upload failed')
      }

      setPanels(prev => {
        const next = [...prev]
        const panel = { ...next[panelIndex] }
        panel.imageUrl = result.url
        next[panelIndex] = panel
        return next
      })

      showToast('Image uploaded successfully', 'success')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image')
      showToast('Failed to upload image', 'error')
    } finally {
      setUploadingPanelIndex(null)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      // Build updates object
      const updates: Record<string, any> = {
        title,
        titleJa,
      }

      // Check if panel order changed
      const originalOrder = panels.map((_, i) => i + 1)
      const orderChanged = panelOrders.some((order, i) => order !== originalOrder[i])

      let updatedPanels = panels

      if (orderChanged && panels.length > 0) {
        // Reorder panels based on new order numbers
        const orderPairs = panelOrders.map((order, idx) => ({ order, idx }))
        orderPairs.sort((a, b) => a.order - b.order)

        // Reorder panels and update panelNumber
        updatedPanels = orderPairs.map((pair, newIdx) => ({
          ...panels[pair.idx],
          panelNumber: newIdx + 1,
        }))
      }

      if (updatedPanels.length > 0) {
        updates.panels = updatedPanels.map((panel, idx) => ({
          ...panel,
          panelNumber: idx + 1,
        }))
        updates.coverImageUrl = updatedPanels[0]?.imageUrl || ''
      }

      const response = await fetch('/api/admin/comics/episodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          updates,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update episode')
      }

      showToast('Episode updated successfully', 'success')
      router.push('/admin/comics')
    } catch (error) {
      console.error('Error updating episode:', error)
      showToast('Failed to update episode', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (sessionLoading || loading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/comics"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Back to Comics
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit Episode
              </h1>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SaveIcon className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Episode Metadata */}
          <section className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Episode Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title (English)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Episode title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title (Japanese)
                </label>
                <input
                  type="text"
                  value={titleJa}
                  onChange={(e) => setTitleJa(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="エピソードタイトル"
                />
              </div>
            </div>
          </section>

          {/* Panel Order */}
          {panels.length > 0 && (
            <section className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Panel Order
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Change numbers to reorder panels (e.g., swap 2↔3)
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {panels.map((panel, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    {panel.imageUrl && (
                      <img
                        src={panel.imageUrl}
                        alt={`Panel ${idx + 1}`}
                        className="w-full aspect-[3/4] object-cover rounded-lg mb-2 border-2 border-gray-200 dark:border-gray-700"
                      />
                    )}
                    <input
                      type="number"
                      min={1}
                      max={panels.length}
                      value={panelOrders[idx] || idx + 1}
                      onChange={(e) => {
                        const newOrders = [...panelOrders]
                        newOrders[idx] = parseInt(e.target.value) || idx + 1
                        setPanelOrders(newOrders)
                      }}
                      className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Panel Content */}
          {panels.length > 0 && (
            <section className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Panel Content
              </h2>
              <div className="space-y-6">
                {panels.map((panel, panelIndex) => (
                  <div
                    key={`panel-${panelIndex}`}
                    className="bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-start gap-6">
                      {/* Panel Image */}
                      <div className="flex-shrink-0 w-32">
                        {panel.imageUrl ? (
                          <img
                            src={panel.imageUrl}
                            alt={`Panel ${panelIndex + 1}`}
                            className="w-32 aspect-[3/4] object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-32 aspect-[3/4] rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-900 flex items-center justify-center text-xs text-gray-400">
                            No image
                          </div>
                        )}
                        <div className="mt-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                            Replace image
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingPanelIndex === panelIndex}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handlePanelImageUpload(panelIndex, file)
                              }
                              e.currentTarget.value = ''
                            }}
                            className="text-xs text-gray-600 dark:text-gray-300"
                          />
                          {uploadingPanelIndex === panelIndex && (
                            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                              Uploading...
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Panel Details */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Panel {panelIndex + 1}
                          </h3>
                          {panel.sceneDescription && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {panel.sceneDescription}
                            </p>
                          )}
                        </div>

                        {/* Dialogues */}
                        {panel.dialogues && panel.dialogues.length > 0 && (
                          <div className="space-y-3">
                            {panel.dialogues.map((dialogue, dialogueIndex) => (
                              <div
                                key={`dialogue-${panelIndex}-${dialogueIndex}`}
                                className="bg-white dark:bg-dark-850 rounded-lg p-4 space-y-3"
                              >
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                  Dialogue {dialogueIndex + 1} · {dialogue.characterName || dialogue.characterId}
                                </div>
                                <textarea
                                  value={dialogue.textJa || ''}
                                  onChange={(e) => updatePanelDialogue(panelIndex, dialogueIndex, 'textJa', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                  rows={2}
                                  placeholder="Japanese text"
                                />
                                <textarea
                                  value={dialogue.textEn || ''}
                                  onChange={(e) => updatePanelDialogue(panelIndex, dialogueIndex, 'textEn', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                  rows={2}
                                  placeholder="English translation"
                                />
                                <input
                                  type="text"
                                  value={dialogue.furigana || ''}
                                  onChange={(e) => updatePanelDialogue(panelIndex, dialogueIndex, 'furigana', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                  placeholder="Furigana (optional, ruby tags)"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Narration */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              Narration
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePanelNarration(panelIndex)}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              {panel.narration ? 'Remove narration' : 'Add narration'}
                            </button>
                          </div>
                          {panel.narration && (
                            <div className="bg-white dark:bg-dark-850 rounded-lg p-4 space-y-3">
                              <textarea
                                value={panel.narration?.textJa || ''}
                                onChange={(e) => updatePanelNarration(panelIndex, 'textJa', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                rows={2}
                                placeholder="Narration (Japanese)"
                              />
                              <textarea
                                value={panel.narration?.textEn || ''}
                                onChange={(e) => updatePanelNarration(panelIndex, 'textEn', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                rows={2}
                                placeholder="Narration (English)"
                              />
                              <input
                                type="text"
                                value={panel.narration?.furigana || ''}
                                onChange={(e) => updatePanelNarration(panelIndex, 'furigana', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
                                placeholder="Narration furigana (optional, ruby tags)"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {uploadError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-4">
                  {uploadError}
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Loading overlay during save */}
      {isSaving && <LoadingOverlay />}
    </div>
  )
}
