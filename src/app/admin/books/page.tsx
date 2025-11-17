'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Book } from '@/types/book';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { TrashIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import Modal from '@/components/ui/Modal';

export default function AdminBooksPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const { showToast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [bookToPublish, setBookToPublish] = useState<{ id: string; title: string } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteSelectedModalOpen, setDeleteSelectedModalOpen] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch both published books and drafts
      const [booksResponse, draftsResponse] = await Promise.all([
        fetch('/api/admin/books?limit=100'),
        fetch('/api/admin/books/drafts?limit=100')
      ]);

      const booksData = booksResponse.ok ? await booksResponse.json() : { books: [] };
      const draftsData = draftsResponse.ok ? await draftsResponse.json() : { drafts: [] };

      // Combine books and drafts (exclude published drafts to avoid duplicates)
      const publishedBookIds = new Set((booksData.books || []).map((b: any) => b.id));

      const allBooks = [
        ...(booksData.books || []),
        ...(draftsData.drafts || [])
          .filter((draft: any) => !publishedBookIds.has(draft.id) && draft.status !== 'published')
          .map((draft: any) => ({
            id: draft.id,
            title: draft.title || 'Untitled',
            titleJa: draft.titleJa || '無題',
            bookName: draft.bookName || 'Unknown',
            author: draft.author,
            jlptLevel: draft.jlptLevel || 'N5',
            content: draft.content || '',
            status: 'draft',
            viewCount: 0,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
          }))
      ];

      setBooks(allBooks);

      if (!booksResponse.ok && !draftsResponse.ok) {
        console.warn('Books API endpoints returned errors - showing empty state');
      }
    } catch (error) {
      console.error('Error loading books:', error);
      showToast('Failed to load books', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user?.isAdmin) {
      loadBooks();
    }
  }, [user, loadBooks]);

  const handleToggleSelect = (bookId: string) => {
    setSelectedIds(prev =>
      prev.includes(bookId)
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === books.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(books.map(b => b.id));
    }
  };

  const openDeleteModal = (bookId: string, title: string) => {
    setBookToDelete({ id: bookId, title });
    setDeleteModalOpen(true);
  };

  const handleDeleteBook = async () => {
    if (!bookToDelete) return;

    try {
      setDeleteModalOpen(false);
      setIsDeleting(true);
      const response = await fetch('/api/admin/books', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookId: bookToDelete.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete book');
      }

      setBooks(prev => prev.filter(b => b.id !== bookToDelete.id));
      setSelectedIds(prev => prev.filter(id => id !== bookToDelete.id));
      showToast('Book deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting book:', error);
      showToast('Failed to delete book', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteSelectedModal = () => {
    if (!selectedIds.length) return;
    setDeleteSelectedModalOpen(true);
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;

    try {
      setDeleteSelectedModalOpen(false);
      setIsDeleting(true);
      for (const id of selectedIds) {
        const response = await fetch('/api/admin/books', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookId: id }),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete book ${id}`);
        }
      }
      setBooks(prev => prev.filter(b => !selectedIds.includes(b.id)));
      setSelectedIds([]);
      showToast('Selected books deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting books:', error);
      showToast('Failed to delete books', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openPublishModal = (draftId: string, title: string) => {
    console.log('📖 Opening publish modal for:', { draftId, title });
    setBookToPublish({ id: draftId, title });
    setPublishModalOpen(true);
    console.log('📖 Modal state updated, publishModalOpen should be true');
  };

  const handlePublishDraft = async () => {
    if (!bookToPublish) return;

    try {
      setPublishModalOpen(false);
      setIsPublishing(true);
      const response = await fetch('/api/admin/books/publish-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: bookToPublish.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to publish draft');
      }

      showToast('Book published successfully!', 'success');
      await loadBooks();
    } catch (error) {
      console.error('Error publishing draft:', error);
      showToast('Failed to publish book', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  if (sessionLoading || loading) {
    return <LoadingOverlay />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <>
      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            📚 Library Books Management
          </h1>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/books/generate"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <span>✨</span>
              Generate Book Summary
            </Link>

            {selectedIds.length > 0 && (
              <button
                onClick={openDeleteSelectedModal}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Books Table */}
        {books.length === 0 ? (
          <div className="bg-white dark:bg-dark-850 rounded-lg p-12 text-center shadow-sm border border-gray-200 dark:border-dark-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No books created yet
            </p>
            <Link
              href="/admin/books/generate"
              className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline transition-colors"
            >
              Generate your first book summary
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-850 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === books.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-400"
                      />
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Title
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Book Name
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Level
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Status
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Views
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr
                      key={book.id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-800"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(book.id)}
                          onChange={() => handleToggleSelect(book.id)}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-400"
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {book.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {book.titleJa}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        <div>
                          {book.bookName}
                          {book.author && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              by {book.author}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                          {book.jlptLevel}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${book.status === 'published'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                          {book.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {book.viewCount || 0}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {/* Edit Button - Always available */}
                          <Link
                            href={`/admin/books/edit/${book.id}`}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit book"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Link>

                          {/* Publish or View */}
                          {book.status === 'draft' ? (
                            <button
                              onClick={() => openPublishModal(book.id, book.title)}
                              disabled={isPublishing}
                              className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 rounded transition-colors disabled:opacity-50"
                              title="Publish book"
                            >
                              Publish
                            </button>
                          ) : (
                            <Link
                              href={`/library/${book.id}`}
                              className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title="View book"
                              target="_blank"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Link>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => openDeleteModal(book.id, book.title)}
                            disabled={isDeleting}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete book"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete/Publish confirmation overlay */}
      {(isDeleting || isPublishing) && <LoadingOverlay />}

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Book"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to publish <strong>&quot;{bookToPublish?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will make the book visible to all users in the Library.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublishDraft}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Publish
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Book Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Book"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>&quot;{bookToDelete?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteBook}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Selected Books Confirmation Modal */}
      <Modal
        isOpen={deleteSelectedModalOpen}
        onClose={() => setDeleteSelectedModalOpen(false)}
        title="Delete Multiple Books"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{selectedIds.length} selected {selectedIds.length === 1 ? 'book' : 'books'}</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteSelectedModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete All
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
