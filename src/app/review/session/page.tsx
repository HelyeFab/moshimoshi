'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReviewEngine from '@/components/review-engine/ReviewEngine';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { useAuth } from '@/hooks/useAuth';
import { LoadingOverlay } from '@/components/ui/Loading';
import { useI18n } from '@/i18n/I18nContext';

export default function ReviewSessionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (initializedRef.current) {
      console.log('[Review Session] Already initialized, skipping');
      return;
    }

    console.log('[Review Session] Page loading...');

    // Get review items from sessionStorage (set by UpcomingReviews or other components)
    const storedItems = sessionStorage.getItem('reviewItems');
    console.log('[Review Session] SessionStorage content:', storedItems ? 'Found items' : 'No items');

    if (storedItems) {
      try {
        const items = JSON.parse(storedItems);
        console.log('[Review Session] Parsed items:', items.length, 'items');
        setReviewContent(items);
        initializedRef.current = true;
        setLoading(false);
        // Clear sessionStorage after loading
        sessionStorage.removeItem('reviewItems');
      } catch (error) {
        console.error('[Review Session] Failed to parse review items:', error);
        router.push('/review-dashboard');
      }
    } else {
      console.log('[Review Session] No items in sessionStorage, redirecting to dashboard');
      // No items to review, go back to dashboard
      router.push('/review-dashboard');
    }
  }, [router]);

  const handleReviewComplete = async (statistics: any) => {
    console.log('[Review Session] Completed with stats:', statistics);

    // Set flag to trigger refresh on dashboard
    sessionStorage.setItem('reviewCompleted', 'true');

    // Dispatch custom event
    window.dispatchEvent(new Event('reviewCompleted'));

    // Navigate back to dashboard after review
    router.push('/review-dashboard');
  };

  const handleCancel = () => {
    router.push('/review-dashboard');
  };

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={t('review.preparingSession')}
        showDoshi={true}
        fullScreen={true}
      />
    );
  }

  if (!reviewContent || reviewContent.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">{t('review.noItems')}</h2>
          <button
            onClick={() => router.push('/review-dashboard')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReviewEngine
      content={reviewContent}
      mode="recognition"
      onComplete={handleReviewComplete}
      onCancel={handleCancel}
      userId={user?.uid || 'anonymous'}
      config={{
        enableSRS: true,
        enableOffline: true,
        enableAudio: true
      }}
    />
  );
}