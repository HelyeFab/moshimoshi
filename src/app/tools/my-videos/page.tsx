import type { Metadata } from 'next';
import MyVideos from './MyVideos';

export const metadata: Metadata = {
  title: 'My Videos - Moshimoshi',
  description: 'Access your saved YouTube videos and practice history for Japanese shadowing exercises. Track your progress and quickly return to videos you\'ve practiced.',
  keywords: [
    "my practice videos",
    "YouTube practice history",
    "Japanese shadowing history",
    "saved videos",
    "practice progress",
    "video bookmarks",
    "learning history"
  ],
  openGraph: {
    title: 'My Videos - Practice History',
    description: 'Track your YouTube practice history and quickly access videos you\'ve watched',
    type: 'website',
  }
};

export default function MyVideosPage() {
  return <MyVideos />;
}