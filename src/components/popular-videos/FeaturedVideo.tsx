'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Play, Star, Sparkles } from 'lucide-react'

interface FeaturedVideoProps {
  videoId: string
  videoTitle: string
  channelName: string
  thumbnailUrl: string
  description: string
  onWatch: () => void
}

export default function FeaturedVideo({
  videoId,
  videoTitle,
  channelName,
  thumbnailUrl,
  description,
  onWatch,
}: FeaturedVideoProps) {
  // Helper function to get YouTube thumbnail
  const getYouTubeThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      {/* Featured Badge */}
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
          Featured
        </h2>
        <Sparkles className="w-5 h-5 text-yellow-500" />
      </div>

      {/* Featured Card */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 via-orange-400/30 to-red-400/30 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative bg-white/90 dark:bg-dark-800/90 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border-2 border-yellow-400/30 dark:border-yellow-500/30">
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Left: Thumbnail */}
            <div className="relative aspect-video rounded-2xl overflow-hidden group/thumbnail">
              <img
                src={thumbnailUrl || getYouTubeThumbnail(videoId)}
                alt={videoTitle}
                className="w-full h-full object-cover transform group-hover/thumbnail:scale-105 transition-transform duration-700"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = getYouTubeThumbnail(videoId)
                }}
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/thumbnail:opacity-100 transition-opacity duration-500" />

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumbnail:opacity-100 transition-all duration-500">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onWatch}
                  className="px-8 py-4 bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300"
                >
                  <Play className="w-6 h-6 text-primary-600" />
                  <span className="font-bold text-lg text-primary-900 dark:text-primary-100">
                    Watch Now
                  </span>
                </motion.button>
              </div>

              {/* Featured Badge on thumbnail */}
              <div className="absolute top-4 left-4 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                <Star className="w-4 h-4 fill-white" />
                Featured
              </div>
            </div>

            {/* Right: Content */}
            <div className="flex flex-col justify-center">
              <h3 className="text-2xl md:text-3xl font-bold mb-3 line-clamp-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                {videoTitle}
              </h3>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {channelName.charAt(0)}
                </div>
                <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {channelName}
                </p>
              </div>

              <p className="text-base text-muted-foreground leading-relaxed mb-6 italic">
                "{description}"
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onWatch}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5" />
                Start Learning
              </motion.button>
            </div>
          </div>

          {/* Bottom accent bar with shimmer effect */}
          <div className="h-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
