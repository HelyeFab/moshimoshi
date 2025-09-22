#!/bin/bash

# Batch SEO migration script for remaining pages

migrate_page() {
    local dir=$1
    local title=$2
    local description=$3
    local keywords=$4
    local path=$5

    # Create backup of original page
    cp "$dir/page.tsx" "$dir/$(basename $dir)Page.tsx" 2>/dev/null

    # Create new page.tsx with SEO
    cat > "$dir/page.tsx" << EOF
import type { Metadata } from 'next';
import $(basename $dir | sed 's/-\([a-z]\)/\U\1/g' | sed 's/^./\U&/')Page from './$(basename $dir | sed 's/-\([a-z]\)/\U\1/g' | sed 's/^./\U&/')Page';
import { generatePageMetadata, structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = generatePageMetadata({
  title: '$title',
  description: '$description',
  keywords: [$keywords],
  path: '$path'
});

export default function Page() {
  const breadcrumbData = structuredData.breadcrumb([
    { "name": "Home", "url": "/" },
    { "name": "$(echo $title | cut -d' ' -f1)", "url": "$path" }
  ]);

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <$(basename $dir | sed 's/-\([a-z]\)/\U\1/g' | sed 's/^./\U&/')Page />
    </>
  );
}
EOF

    echo "✅ Migrated: $dir"
}

# Migrate each page
echo "Starting batch SEO migration..."

# Kanji Moods
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-moods" \
  "Kanji Mood Boards - Themed Kanji Collections" \
  "Study kanji grouped by themes and moods. Learn related kanji together with our curated mood boards covering emotions, nature, daily life, and more." \
  '"kanji mood boards", "themed kanji", "kanji collections", "kanji by theme", "kanji groups", "emotional kanji", "nature kanji", "themed learning"' \
  "/kanji-moods"

# Kanji Connection
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-connection" \
  "Kanji Connection Game - Visual Memory Challenge" \
  "Test your kanji recognition skills with our connection game. Match kanji characters with their meanings in this fun, interactive memory game." \
  '"kanji game", "kanji connection", "memory game", "kanji matching", "kanji practice game", "visual learning", "interactive kanji"' \
  "/kanji-connection"

# Pricing
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/pricing" \
  "Pricing Plans - Choose Your Learning Path" \
  "Flexible pricing plans for every learner. Start free or unlock premium features for accelerated Japanese learning with our comprehensive tools." \
  '"pricing", "subscription plans", "premium features", "Japanese learning cost", "free vs premium", "learning plans"' \
  "/pricing"

# Settings
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/settings" \
  "Settings - Customize Your Learning Experience" \
  "Personalize your Japanese learning journey. Configure study preferences, notification settings, and learning goals to match your style." \
  '"settings", "preferences", "customization", "learning settings", "app configuration", "user preferences"' \
  "/settings"

# Account
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/account" \
  "My Account - Profile & Progress" \
  "Manage your account, view learning statistics, and track your Japanese proficiency journey. Monitor achievements and study streaks." \
  '"account", "profile", "user dashboard", "learning progress", "statistics", "achievements"' \
  "/account"

# Favourites
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/favourites" \
  "My Favourites - Saved Learning Content" \
  "Access your bookmarked kanji, vocabulary, and stories. Quickly review your favorite content and personalized study materials." \
  '"favourites", "bookmarks", "saved content", "favorite kanji", "saved vocabulary", "personal collection"' \
  "/favourites"

# Contact
migrate_page "/home/beano/DevProjects/next_js/moshimoshi/src/app/contact" \
  "Contact Us - Get Support" \
  "Need help with your Japanese learning? Contact our support team for assistance, feedback, or suggestions to improve your experience." \
  '"contact", "support", "help", "customer service", "feedback", "contact form"' \
  "/contact"

echo "Batch migration complete!"