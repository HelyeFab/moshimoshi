'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBlogPost, getAllBlogPosts } from '@/services/blogService';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { useI18n } from '@/i18n/I18nContext';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  tags: string[];
  status: 'draft' | 'published' | 'scheduled';
  publishDate: Date | string | Timestamp;
  readingTime?: string;
  views?: number;
  cover?: string;
}

export default function AdminBlogPage() {
  const router = useRouter();
  const { t, strings } = useI18n();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    postId: string;
    postTitle: string;
  }>({ isOpen: false, postId: '', postTitle: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();

    // Check for success message from edit/create pages
    const storedMessage = sessionStorage.getItem('blogSuccessMessage');
    if (storedMessage) {
      setSuccessMessage(storedMessage);
      sessionStorage.removeItem('blogSuccessMessage');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const firestorePosts = await getAllBlogPosts(true);

      // Format Firestore posts
      const formattedPosts = firestorePosts.map(post => ({
        ...post,
        publishDate: post.publishDate instanceof Timestamp
          ? post.publishDate.toDate().toISOString()
          : post.publishDate,
      }));

      // Sort by date
      formattedPosts.sort((a, b) => {
        const dateA = typeof a.publishDate === 'string' ? new Date(a.publishDate) : a.publishDate;
        const dateB = typeof b.publishDate === 'string' ? new Date(b.publishDate) : b.publishDate;
        return dateB.getTime() - dateA.getTime();
      });

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.postId) return;

    setIsDeleting(true);
    try {
      await deleteBlogPost(deleteModal.postId);
      setSuccessMessage(t('admin.blog.success.deleted'));
      await fetchPosts();

      // Close modal
      setDeleteModal({ isOpen: false, postId: '', postTitle: '' });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting post:', error);
      setSuccessMessage(t('admin.blog.errors.deleteFailed'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (id: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      postId: id,
      postTitle: title
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {t(`admin.blog.status.${status}`)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('admin.blog.deleteConfirmation.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('admin.blog.deleteConfirmation.message')}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-6">
              "{deleteModal.postTitle}"
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, postId: '', postTitle: '' })}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? t('common.deleting') : t('admin.blog.buttons.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {successMessage}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('admin.blog.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('admin.blog.description')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
              <button
                onClick={() => router.push('/admin/blog/new')}
                className="w-full sm:w-auto px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('admin.blog.createNew')}
              </button>
              <Link
                href="/blog"
                target="_blank"
                className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-dark-850 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
              >
                {t('admin.blog.viewBlog')} →
              </Link>
            </div>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('admin.blog.noPosts')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('admin.blog.createFirst')}
              </p>
              <button
                onClick={() => router.push('/admin/blog/new')}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('admin.blog.createNew')}
              </button>
            </div>
          ) : (
            <>
              {/* Mobile view - Cards */}
              <div className="block lg:hidden space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="space-y-3">
                      {/* Title and slug */}
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{post.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{post.slug}</p>
                      </div>

                      {/* Badges */}
                      <div className="flex gap-2">
                        {getStatusBadge(post.status)}
                      </div>

                      {/* Meta info */}
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>{strings.admin.blog.fields.author}: {post.author}</p>
                        <p>{formatDate(post.publishDate)}</p>
                        <p>{post.views || 0} {t('admin.blog.fields.views')}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {t('admin.blog.buttons.view')}
                        </Link>
                        <button
                          onClick={() => router.push(`/admin/blog/${post.id}/edit`)}
                          className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                        >
                          {t('admin.blog.buttons.edit')}
                        </button>
                        <button
                          onClick={() => openDeleteModal(post.id, post.title)}
                          className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          {t('admin.blog.buttons.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view - Table */}
              <div className="hidden lg:block bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-dark-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('admin.blog.fields.title')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('admin.blog.fields.status')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('admin.blog.fields.author')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('admin.blog.fields.publishDate')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('admin.blog.fields.views')}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('common.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {posts.map((post) => (
                        <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{post.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{post.slug}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(post.status)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {post.author}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(post.publishDate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {post.views || 0}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/blog/${post.slug}`}
                                target="_blank"
                                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                {t('admin.blog.buttons.view')}
                              </Link>
                              <button
                                onClick={() => router.push(`/admin/blog/${post.id}/edit`)}
                                className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                              >
                                {t('admin.blog.buttons.edit')}
                              </button>
                              <button
                                onClick={() => openDeleteModal(post.id, post.title)}
                                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              >
                                {t('admin.blog.buttons.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}