'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Story } from '@/types/story'
import type { CachedStory } from '@/lib/stories/story-cache.types'
import { storyService } from '@/lib/services/StoryService'
import { useStoryCache } from '@/hooks/useStoryCache'
import EnhancedArticleReader from '@/components/news/EnhancedArticleReaderFinal'
import Navbar from '@/components/layout/Navbar'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const { user } = useAuth()
  const slug = params.slug as string
  const { getStoryBySlug, cacheStory } = useStoryCache()

  const [story, setStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)

  const normalizeCachedStory = (cached: CachedStory): Story => ({
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
    publishedAt: cached.publishedAt ? new Date(cached.publishedAt) : undefined,
    audioGeneratedAt: cached.audioGeneratedAt ? new Date(cached.audioGeneratedAt) : undefined
  })

  useEffect(() => {
    const loadStory = async () => {
      try {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

        if (isOffline) {
          const cachedStory = await getStoryBySlug(slug)
          if (cachedStory) {
            setStory(normalizeCachedStory(cachedStory))
            return
          }
          throw new Error('Offline with no cached story')
        }

        const response = await fetch(`/api/stories/${slug}`)

        if (!response.ok) {
          let errorData: any = {}
          let errorText = ''
          try {
            errorData = await response.json()
          } catch {
            try {
              errorText = await response.text()
            } catch {
              errorText = ''
            }
          }
          const errorMessage =
            errorData?.error ||
            errorData?.message ||
            errorText ||
            'Unknown error'

          // Log detailed error info for debugging
          console.error('[Story Detail] API Error:', {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            slug,
            errorData,
            errorText
          })

          // Throw specific error based on status code
          if (response.status === 401) {
            throw new Error('Please sign in to view stories')
          } else if (response.status === 403) {
            throw new Error('You do not have permission to view this story')
          } else if (response.status === 429) {
            throw new Error('Daily story limit reached. Upgrade to premium for unlimited access.')
          } else if (response.status === 404) {
            throw new Error('Story not found or is not published')
          } else {
            throw new Error(`Failed to load story: ${errorMessage}`)
          }
        }

        const data = await response.json()

        if (!data.success || !data.story) {
          console.error('[Story Detail] Invalid response data:', data)
          throw new Error('Story data is invalid or missing')
        }

        setStory(data.story)
        await cacheStory(data.story)
      } catch (error) {
        console.error('[Story Detail] Error loading story:', error)

        // Try to fall back to cached version
        const cachedStory = await getStoryBySlug(slug)
        if (cachedStory) {
          console.log('[Story Detail] Using cached story as fallback')
          setStory(normalizeCachedStory(cachedStory))
          showToast('Viewing cached version of story', 'info')
          return
        }

        // Show specific error message to user
        const errorMessage = error instanceof Error ? error.message : 'Failed to load story'
        showToast(errorMessage, 'error')
        router.push('/stories')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadStory()
    }
  }, [slug, router, showToast])

  const handleComplete = async () => {
    if (story) {
      // Increment completion count
      await storyService.incrementCompletionCount(story.id)
    }
    showToast('Congratulations on completing the story!', 'success')
    router.push('/stories')
  }

  const handleExit = () => {
    router.push('/stories')
  }

  const handleBack = () => {
    router.push('/stories')
  }

  if (loading) {
    return <LoadingOverlay />
  }

  if (!story) {
    return null
  }

  // Convert story to article format for the unified reader
  // The reader will use pages for multi-page navigation
  const articleFromStory = {
    id: story.id,
    title: story.titleJa || story.title,
    content: story.pages[0]?.text || '', // First page content as fallback
    summary: story.description,
    url: `/stories/${story.slug}`,
    imageUrl: story.coverImageUrl,
    publishDate: story.publishedAt || story.createdAt,
    source: 'Moshimoshi Stories',
    category: story.theme,
    difficulty: story.jlptLevel,
    tags: story.tags,
    metadata: {
      wordCount: story.pages.reduce((acc, page) => acc + (page.text?.length || 0), 0),
      readingTime: Math.ceil(story.pages.length * 2), // Estimate 2 min per page
      hasFurigana: true,
    },
    // Audio fields from story
    generatedContentAudioUrl: story.fullAudioUrl,
    audioProvider: story.audioProvider as 'kokoro' | 'elevenlabs' | 'voicevox' | undefined,
    audioVoice: story.audioVoice,
    audioStatus:
      story.audioStatus === 'complete'
        ? ('generated' as const)
        : (story.audioStatus as 'pending' | 'generated' | 'failed' | 'partial' | undefined),
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-dark-850">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <EnhancedArticleReader
        article={articleFromStory}
        onBack={handleBack}
        pages={story.pages}
        quiz={story.quiz}
        onComplete={handleComplete}
        onExit={handleExit}
        storyTitle={story.titleJa || story.title}
        contentType="story"
      />

      <MobileNavSpacer />
    </div>
  )
}
