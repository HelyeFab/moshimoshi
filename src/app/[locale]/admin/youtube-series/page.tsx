'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { collection, query, orderBy, getDocs, deleteDoc, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { YouTubeChannel, YouTubeChannelFormData } from '@/types/youtube-series';
import { formatDistanceToNow } from 'date-fns';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast/ToastContext';
import {
  Youtube,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  X,
  Monitor,
  Sparkles,
  Users,
  Video,
  Eye,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react';

export default function AdminYouTubeSeriesPage() {
  const { strings } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<YouTubeChannel | null>(null);
  const [formData, setFormData] = useState<YouTubeChannelFormData>({
    channelUrl: '',
    monitoringEnabled: true,
    checkInterval: 24,
    autoCreateResource: true,
    resourceCategory: 'YouTube Series',
    resourceTags: '',
    autoExtractTranscript: true,
    shadowingEnabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    channel: YouTubeChannel | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    channel: null,
    isDeleting: false
  });

  // Check admin access
  useEffect(() => {
    if (!user?.isAdmin) {
      router.push('/');
    }
  }, [user, router]);

  // Load channels
  useEffect(() => {
    if (user?.isAdmin) {
      loadChannels();
    }
  }, [user]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const channelsQuery = query(
        collection(db, 'youtubeChannels'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(channelsQuery);
      const channelsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as YouTubeChannel));

      setChannels(channelsList);
    } catch (error) {
      console.error('Error loading channels:', error);
      showToast('Failed to load channels', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Fetch channel information using the API
      const response = await fetch('/api/youtube/channel-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formData.channelUrl.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch channel information');
      }

      const data = await response.json();

      // Build channel data
      const channelData = {
        channelId: data.channel.channelId,
        channelUrl: data.channel.channelUrl,
        channelTitle: data.channel.channelTitle,
        description: data.channel.description,
        customUrl: data.channel.customUrl,
        thumbnailUrl: data.channel.thumbnailUrl,
        bannerUrl: data.channel.bannerUrl,
        country: data.channel.country,
        publishedAt: data.channel.publishedAt,
        subscriberCount: data.channel.subscriberCount,
        videoCount: data.channel.videoCount,
        viewCount: data.channel.viewCount,
        sourceVideoUrl: data.sourceVideo ? formData.channelUrl : null,
        sourceVideoId: data.sourceVideo?.videoId,
        sourceVideoTitle: data.sourceVideo?.title,
        monitoringEnabled: formData.monitoringEnabled,
        checkInterval: formData.checkInterval,
        autoCreateResource: formData.autoCreateResource,
        resourceCategory: formData.resourceCategory,
        resourceTags: formData.resourceTags.split(',').map(tag => tag.trim()).filter(tag => tag),
        autoExtractTranscript: formData.autoExtractTranscript,
        shadowingEnabled: formData.shadowingEnabled,
        videosImported: 0,
        totalShadowingSessions: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      let docId;
      if (editingChannel) {
        // Update existing channel
        await updateDoc(doc(db, 'youtubeChannels', editingChannel.id), {
          ...channelData,
          createdAt: editingChannel.createdAt, // Preserve original creation date
        });
        docId = editingChannel.id;
        showToast('Channel updated successfully', 'success');
      } else {
        // Add new channel
        const docRef = await addDoc(collection(db, 'youtubeChannels'), channelData);
        docId = docRef.id;
        showToast('Channel added successfully', 'success');

        // Auto-sync the channel after adding
        await syncChannel(docId);
      }

      // Reset form and reload
      setFormData({
        channelUrl: '',
        monitoringEnabled: true,
        checkInterval: 24,
        autoCreateResource: true,
        resourceCategory: 'YouTube Series',
        resourceTags: '',
        autoExtractTranscript: true,
        shadowingEnabled: true,
      });
      setShowAddForm(false);
      setEditingChannel(null);
      loadChannels();
    } catch (error: any) {
      console.error('Error saving channel:', error);
      showToast(error.message || 'Failed to save channel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const syncChannel = async (channelId: string) => {
    try {
      setSyncing(channelId);

      const response = await fetch('/api/admin/youtube-series/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId })
      });

      if (response.ok) {
        const result = await response.json();
        await loadChannels();
        showToast(`Synced ${result.videosAdded} new videos, updated ${result.videosUpdated}`, 'success');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Error syncing channel:', error);
      showToast(error.message || 'Failed to sync channel', 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handleEdit = (channel: YouTubeChannel) => {
    setEditingChannel(channel);
    setFormData({
      channelUrl: channel.channelUrl,
      monitoringEnabled: channel.monitoringEnabled,
      checkInterval: channel.checkInterval,
      autoCreateResource: channel.autoCreateResource,
      resourceCategory: channel.resourceCategory,
      resourceTags: channel.resourceTags.join(', '),
      autoExtractTranscript: channel.autoExtractTranscript,
      shadowingEnabled: channel.shadowingEnabled,
    });
    setShowAddForm(true);
  };

  const handleDelete = (channel: YouTubeChannel) => {
    setDeleteConfirm({
      isOpen: true,
      channel,
      isDeleting: false
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.channel) return;

    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));

    try {
      await deleteDoc(doc(db, 'youtubeChannels', deleteConfirm.channel.id));
      loadChannels();
      showToast('Channel deleted successfully', 'success');
      setDeleteConfirm({ isOpen: false, channel: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting channel:', error);
      showToast('Failed to delete channel', 'error');
      setDeleteConfirm(prev => ({ ...prev, isDeleting: false }));
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="w-full">
      {loading && <LoadingOverlay />}

      <div className="w-full">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <Youtube className="w-6 sm:w-8 h-6 sm:h-8 text-red-600 flex-shrink-0" />
              <span>YouTube Series Management</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 sm:mt-0 sm:ml-11">
              Manage YouTube channels for curated Japanese learning content
            </p>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-white dark:bg-dark-800 rounded-lg sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {editingChannel ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingChannel ? 'Edit Channel' : 'Add New Channel'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">YouTube URL</label>
                  <input
                    type="url"
                    value={formData.channelUrl}
                    onChange={(e) => setFormData({ ...formData, channelUrl: e.target.value })}
                    placeholder="Channel URL or Video URL (e.g. https://youtu.be/VIDEO_ID)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground"
                    required
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You can paste either a channel URL or any video URL from the channel
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Resource Category</label>
                    <input
                      type="text"
                      value={formData.resourceCategory}
                      onChange={(e) => setFormData({ ...formData, resourceCategory: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Check Interval (hours)</label>
                    <input
                      type="number"
                      value={formData.checkInterval}
                      onChange={(e) => setFormData({ ...formData, checkInterval: parseInt(e.target.value) })}
                      min="1"
                      max="168"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.resourceTags}
                    onChange={(e) => setFormData({ ...formData, resourceTags: e.target.value })}
                    placeholder="japanese, learning, beginner"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.monitoringEnabled}
                      onChange={(e) => setFormData({ ...formData, monitoringEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Enable monitoring</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.autoCreateResource}
                      onChange={(e) => setFormData({ ...formData, autoCreateResource: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Auto-create resources</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.autoExtractTranscript}
                      onChange={(e) => setFormData({ ...formData, autoExtractTranscript: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Auto-extract transcripts</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.shadowingEnabled}
                      onChange={(e) => setFormData({ ...formData, shadowingEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Enable shadowing integration</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving...' : (editingChannel ? 'Update' : 'Add')} Channel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingChannel(null);
                      setFormData({
                        channelUrl: '',
                        monitoringEnabled: true,
                        checkInterval: 24,
                        autoCreateResource: true,
                        resourceCategory: 'YouTube Series',
                        resourceTags: '',
                        autoExtractTranscript: true,
                        shadowingEnabled: true,
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mb-6 sm:mb-8 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Add New Channel
            </button>
          )}

          {/* Channels List */}
          <div className="space-y-4">
            {channels.length === 0 ? (
              <div className="text-center py-8 sm:py-12 bg-white dark:bg-dark-800 rounded-lg sm:rounded-2xl border border-gray-200 dark:border-dark-700">
                <Youtube className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-muted-foreground text-sm sm:text-base">No channels added yet.</p>
              </div>
            ) : (
              channels.map((channel) => (
                <div key={channel.id} className="bg-white dark:bg-dark-800 rounded-lg sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        {/* Channel Thumbnail */}
                        {channel.thumbnailUrl ? (
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.channelTitle}
                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-dark-600"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-dark-700 flex items-center justify-center">
                            <Youtube className="w-8 h-8 text-gray-500" />
                          </div>
                        )}

                        {/* Channel Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {channel.channelTitle}
                          </h3>
                          {channel.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {channel.description}
                            </p>
                          )}
                          <a
                            href={channel.channelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1"
                          >
                            {channel.customUrl || channel.channelUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Channel Stats */}
                      {(channel.subscriberCount || channel.videoCount || channel.viewCount) && (
                        <div className="flex flex-wrap gap-4 mb-3 p-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg">
                          {(channel.subscriberCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-muted-foreground">Subscribers:</span>
                              <span className="font-medium text-foreground">
                                {(channel.subscriberCount ?? 0) >= 1000000
                                  ? `${((channel.subscriberCount ?? 0) / 1000000).toFixed(1)}M`
                                  : (channel.subscriberCount ?? 0) >= 1000
                                  ? `${((channel.subscriberCount ?? 0) / 1000).toFixed(1)}K`
                                  : (channel.subscriberCount ?? 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {(channel.videoCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                              <Video className="w-4 h-4 text-gray-500" />
                              <span className="text-muted-foreground">Videos:</span>
                              <span className="font-medium text-foreground">{(channel.videoCount ?? 0).toLocaleString()}</span>
                            </div>
                          )}
                          {(channel.viewCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                              <Eye className="w-4 h-4 text-gray-500" />
                              <span className="text-muted-foreground">Views:</span>
                              <span className="font-medium text-foreground">
                                {(channel.viewCount ?? 0) >= 1000000000
                                  ? `${((channel.viewCount ?? 0) / 1000000000).toFixed(1)}B`
                                  : (channel.viewCount ?? 0) >= 1000000
                                  ? `${((channel.viewCount ?? 0) / 1000000).toFixed(1)}M`
                                  : (channel.viewCount ?? 0) >= 1000
                                  ? `${((channel.viewCount ?? 0) / 1000).toFixed(1)}K`
                                  : (channel.viewCount ?? 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${channel.monitoringEnabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                          }`}>
                          {channel.monitoringEnabled ? <Monitor className="w-3 h-3 mr-1" /> : null}
                          {channel.monitoringEnabled ? 'Monitoring' : 'Paused'}
                        </span>

                        {channel.autoCreateResource && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            Auto-create
                          </span>
                        )}

                        {channel.shadowingEnabled && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Shadowing
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Category: {channel.resourceCategory}</p>
                        <p>Tags: {channel.resourceTags?.join(', ') || 'None'}</p>
                        <p>Check every: {channel.checkInterval} hours</p>
                        <p>Videos imported: {channel.videosImported || 0}</p>
                        {channel.lastCheckedAt && (
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Last checked: {formatDistanceToNow(
                              (channel.lastCheckedAt.toDate ? channel.lastCheckedAt.toDate() : new Date(channel.lastCheckedAt as unknown as string | number)) as Date,
                              { addSuffix: true }
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => syncChannel(channel.id)}
                        className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Sync Videos"
                        disabled={syncing === channel.id}
                      >
                        {syncing === channel.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(channel)}
                        className="p-2 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(channel)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Delete Channel</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete "{deleteConfirm.channel?.channelTitle}"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, channel: null, isDeleting: false })}
                disabled={deleteConfirm.isDeleting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 text-foreground rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirm.isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteConfirm.isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}