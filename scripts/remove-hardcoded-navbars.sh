#!/bin/bash

# Script to remove all hardcoded Navbar components from pages
# Navigation is now global in root layout via NavigationWrapper

FILES=(
"/home/beano/DevProjects/next_js/moshimoshi/src/app/account/AccountPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/achievements/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/admin/stories/edit/[id]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/admin/stories/generate/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/anki-import/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/blog/[slug]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/blog/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/contact/ContactPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/contact/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/credits/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/drill/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/flashcards/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/kana-drop/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/kanji-simon/[boardId]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/kanji-simon/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/reading-routes/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/sentence-scramble/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/games/stroke-order/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-browser/KanjiBrowserPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-browser/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-connection/KanjiConnectionPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-connection/families/KanjiFamiliesPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-connection/radicals/KanjiRadicalsPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-connection/visual-layout/VisualLayoutPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-moods/KanjiMoodsPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-moods/[boardId]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/kanji-moods/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/leaderboard/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/learn/conjugation/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/lists/[listId]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/lists/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/my-videos/MyVideos.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/news/NewsPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/news/[id]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/news/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/popular-videos/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/pricing/PricingPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/pricing/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/privacy/PrivacyPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/privacy/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/resources/[id]/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/resources/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/review-dashboard/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/settings/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/stories/StoriesPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/stories/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/terms/TermsPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/terms/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/test-entitlements/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/test-notifications/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/textbook-vocabulary/TextbookVocabularyPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/textbook-vocabulary/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/todos/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/tools/textbook-vocabulary/TextbookVocabularyPage.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/tools/textbook-vocabulary/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/vocabulary/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/youtube-series/page.tsx"
"/home/beano/DevProjects/next_js/moshimoshi/src/app/youtube-shadowing/page.tsx"
)

echo "Removing hardcoded Navbar imports and components from all pages..."

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"

    # Replace import statement
    sed -i "s/^import Navbar from '@\/components\/layout\/Navbar'/\/\/ Navigation is now global via NavigationWrapper in root layout/" "$file"

    # Remove <Navbar ... /> blocks (multi-line)
    sed -i '/<Navbar/,/\/>/c\      {/* Navigation is now global - rendered in root layout */}' "$file"
  fi
done

echo "Done! Removed hardcoded navbars from ${#FILES[@]} files."
