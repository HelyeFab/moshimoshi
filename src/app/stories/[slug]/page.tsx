'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Story } from '@/types/story';
import { storyService } from '@/lib/services/StoryService';
import StoryReader from '@/components/story/StoryReader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast/ToastContext';

export default function StoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const slug = params.slug as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStory = async () => {
      try {
        // Try to load by slug first
        let storyData = await storyService.getStoryBySlug(slug);

        // If not found by slug, try as ID (for backward compatibility)
        if (!storyData) {
          storyData = await storyService.getStory(slug);
        }

        if (!storyData) {
          showToast('Story not found', 'error');
          router.push('/stories');
          return;
        }

        // Only show published stories to non-admin users
        if (storyData.status !== 'published') {
          showToast('This story is not available', 'error');
          router.push('/stories');
          return;
        }

        setStory(storyData);
      } catch (error) {
        console.error('Error loading story:', error);
        showToast('Failed to load story', 'error');
        router.push('/stories');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      loadStory();
    }
  }, [slug, router, showToast]);

  const handleComplete = () => {
    showToast('Congratulations on completing the story!', 'success');
    router.push('/stories');
  };

  const handleExit = () => {
    router.push('/stories');
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  if (!story) {
    return null;
  }

  return <StoryReader story={story} onComplete={handleComplete} onExit={handleExit} />;
}