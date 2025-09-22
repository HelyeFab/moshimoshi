'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import MoodBoardManager from '@/components/admin/MoodBoardManager';
import GenerateKanjiMoodboardModal from '@/components/admin/GenerateKanjiMoodboardModal';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { useMoodBoards } from '@/hooks/useMoodBoards';

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  // If it's already a color function like rgb() or hsl(), return as-is
  if (color.includes('(')) return color;

  // Convert hex to RGB, adjust, and return hex
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.max(0, Math.min(255, r + amount));
  const newG = Math.max(0, Math.min(255, g + amount));
  const newB = Math.max(0, Math.min(255, b + amount));

  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export default function AdminMoodboardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { showToast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const { createMoodBoard } = useMoodBoards();

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        // Check if user is admin
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const adminStatus = userData?.role === 'admin' || userData?.isAdmin === true;

        setIsAdmin(adminStatus);

        if (!adminStatus) {
          showToast(
            `${t('error.unauthorized')}: ${t('admin.requiresAdmin')}`,
            'error'
          );
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        showToast(
          `${t('error.somethingWentWrong')}: ${t('admin.errorCheckingStatus')}`,
          'error'
        );
        router.push('/dashboard');
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading, router, showToast, t]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
    }
  }, [user, authLoading, router]);

  const handleMoodboardGenerated = async (data: any) => {
    try {
      // Transform the generated data into moodboard format
      const moodboard = {
        title: data.category || data.title,
        description: data.description,
        emoji: data.emoji,
        jlpt: data.jlptLevel || 'N5',
        background: data.themeColor ?
          `linear-gradient(135deg, ${data.themeColor} 0%, ${adjustColor(data.themeColor, -20)} 100%)` :
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        kanji: data.kanjiList.map((item: any) => ({
          char: item.kanji,
          meaning: item.meaning,
          onyomi: item.onyomi || [],
          kunyomi: item.kunyomi || [],
          jlpt: item.jlptLevel,
          strokeCount: item.strokeCount,
          examples: item.examples || [],
          tags: item.tags || []
        })),
        isActive: true,
        sortOrder: 0
      };

      // Create the moodboard
      const moodboardId = await createMoodBoard(moodboard);

      // If user also wanted to generate a story
      if (data.generateStory && moodboardId) {
        showToast('Moodboard created! Generating story...', 'info');

        try {
          const storyResponse = await fetch('/api/admin/generate-story-from-moodboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await user!.getIdToken()}`
            },
            body: JSON.stringify({
              moodBoardId: moodboardId,
              moodBoard: moodboard
            })
          });

          if (storyResponse.ok) {
            const storyData = await storyResponse.json();
            showToast(`Story "${storyData.title}" created successfully!`, 'success');
            // Optionally navigate to the story
            // router.push(`/stories/${storyData.id}`);
          }
        } catch (storyError) {
          console.error('Error generating story:', storyError);
          showToast('Moodboard created but story generation failed', 'warning');
        }
      }

      setShowGenerateModal(false);
    } catch (error) {
      console.error('Error creating moodboard:', error);
      showToast('Failed to create moodboard', 'error');
    }
  };

  if (authLoading || checkingAdmin) {
    return <LoadingOverlay />;
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-100">
              {t('admin.moodboards.title')}
            </h1>

            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              {t('admin.moodboards.generateWithAI')}
            </button>
          </div>

          <p className="text-muted-foreground dark:text-dark-400">
            {t('admin.moodboards.description')}
          </p>
        </div>

        {/* Moodboard Manager Component */}
        <MoodBoardManager />

        {/* Generate Modal */}
        <GenerateKanjiMoodboardModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleMoodboardGenerated}
        />
      </div>
    </div>
  );
}