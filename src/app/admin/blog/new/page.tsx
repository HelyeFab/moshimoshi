'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { saveBlogPost } from '@/services/blogService';
import { useI18n } from '@/i18n/I18nContext';

export default function NewBlogPostPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleSave = async (postData: any) => {
    try {
      setSaving(true);

      // Send plain data to the API - NO Firestore types on client!
      const post = {
        ...postData,
        // publishDate should be an ISO string or null
        publishDate: postData.publishDate || new Date().toISOString(),
      };

      await saveBlogPost(post);

      // Show success message and redirect
      const statusMessage = postData.status === 'draft'
        ? t('admin.blog.success.created')
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
      // Show error message via sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('blogSuccessMessage', t('admin.blog.errors.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.blog.createNew')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.blog.description')}
          </p>
        </div>

        <BlogEditor
          onSave={handleSave}
          saving={saving}
          onCancel={() => router.push('/admin/blog')}
        />
      </div>
    </div>
  );
}