'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Story } from '@/types/story'
import { storyService } from '@/lib/services/StoryService'
import EnhancedArticleReader from '@/components/news/EnhancedArticleReaderFinal'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useToast } from '@/components/ui/Toast/ToastContext'

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const slug = params.slug as string

  const [story, setStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStory = async () => {
      try {
        // Try to load by slug first
        let storyData = await storyService.getStoryBySlug(slug)

        // If not found by slug, try as ID (for backward compatibility)
        if (!storyData) {
          storyData = await storyService.getStory(slug)
        }

        if (!storyData) {
          showToast('Story not found', 'error')
          router.push('/stories')
          return
        }

        // Only show published stories to non-admin users
        if (storyData.status !== 'published') {
          showToast('This story is not available', 'error')
          router.push('/stories')
          return
        }

        setStory(storyData)
      } catch (error) {
        console.error('Error loading story:', error)
        showToast('Failed to load story', 'error')
        router.push('/stories')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadStory()
    }
  }, [slug, router, showToast])

  const handleComplete = () => {
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
    audioProvider: story.audioProvider as 'edge-tts' | 'voicevox' | 'kokoro' | undefined,
    audioVoice: story.audioVoice,
    audioStatus:
      story.audioStatus === 'complete'
        ? ('generated' as const)
        : (story.audioStatus as 'pending' | 'generated' | 'failed' | 'partial' | undefined),
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-dark-850">
      <EnhancedArticleReader
        article={articleFromStory}
        onBack={handleBack}
        pages={story.pages}
        quiz={story.quiz}
        onComplete={handleComplete}
        onExit={handleExit}
        storyTitle={story.titleJa || story.title}
      />
      <MobileNavSpacer />
    </div>
  )
}
