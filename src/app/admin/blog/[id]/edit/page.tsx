'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { getBlogPostById, saveBlogPost, BlogPost } from '@/services/blogService';
import { useI18n } from '@/i18n/I18nContext';

export default function EditBlogPostPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { t } = useI18n();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [params.id]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const fetchedPost = await getBlogPostById(params.id);
      if (fetchedPost) {
        setPost(fetchedPost);
      } else {
        // Post not found, redirect with error message
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('blogSuccessMessage', t('admin.blog.errors.loadFailed'));
        }
        router.push('/admin/blog');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      // Failed to load, redirect with error message
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('blogSuccessMessage', t('admin.blog.errors.loadFailed'));
      }
      router.push('/admin/blog');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (postData: any) => {
    try {
      setSaving(true);

      // Send plain data to the API - NO Firestore types on client!
      const updatedPost = {
        ...postData,
        publishDate: postData.publishDate || new Date().toISOString(),
      };

      await saveBlogPost(updatedPost, params.id);

      // Show success message and redirect
      const statusMessage = postData.status === 'draft'
        ? t('admin.blog.success.updated')
        : postData.status === 'published'
          ? t('admin.blog.success.published')
          : t('admin.blog.success.scheduled');

      // Store success message for display on blog list page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('blogSuccessMessage', statusMessage);
      }

      router.push('/admin/blog');
    } catch (error) {
      console.error('Error saving post:', error);
      // Show inline error message instead of alert
      const errorMessage = t('admin.blog.errors.saveFailed');
      // We could add an error state here if needed
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.blog.buttons.edit')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.blog.description')}
          </p>
        </div>

        <BlogEditor
          post={post}
          onSave={handleSave}
          saving={saving}
          onCancel={() => router.push('/admin/blog')}
        />
      </div>
    </div>
  );
}