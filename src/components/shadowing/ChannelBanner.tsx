'use client';

import React from 'react';
import styles from './ChannelBanner.module.css';

interface ChannelBannerProps {
  channelTitle: string;
  videoTitle: string;
  channelAvatarUrl?: string;
}

export default function ChannelBanner({
  channelTitle,
  videoTitle,
  channelAvatarUrl,
}: ChannelBannerProps) {
  // Extract first letter for fallback avatar
  const channelInitial = channelTitle.charAt(0).toUpperCase();

  return (
    <div className={styles.banner}>
      <div className={styles.bannerInner}>
        {/* Channel Avatar */}
        <div className={styles.avatarContainer}>
          {channelAvatarUrl ? (
            <img
              src={channelAvatarUrl}
              alt={channelTitle}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarFallback}>
              {channelInitial}
            </div>
          )}
        </div>

        {/* Channel & Video Info */}
        <div className={styles.info}>
          <h2 className={styles.channelName}>{channelTitle}</h2>
          <p className={styles.videoTitle}>{videoTitle}</p>
        </div>
      </div>
    </div>
  );
}
