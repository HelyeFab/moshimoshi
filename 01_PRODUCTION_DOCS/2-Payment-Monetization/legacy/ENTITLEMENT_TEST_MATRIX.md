# Entitlement Test Matrix

Generated from `config/features.v1.json`. Pass/Fail based on limits only (no lifecycle or permission overrides).

## guest

| Feature                    | Limit Type | Limit | Usage=0          | Usage=limit-1   | Usage=limit     | Expected Result |
| -------------------------- | ---------- | ----- | ---------------- | --------------- | --------------- | --------------- |
| hiragana_practice          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| katakana_practice          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| kanji_browser              | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| kanji_connection           | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| kanji_mastery              | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| drawing_practice           | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| custom_lists               | monthly    | 0     | Fail             | N/A             | Fail            | Always fail     |
| conjugation_drill          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| grammar_explanations       | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| youtube_shadowing          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| media_upload               | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| save_items                 | monthly    | 0     | Fail             | N/A             | Fail            | Always fail     |
| todos                      | monthly    | 0     | Fail             | N/A             | Fail            | Always fail     |
| flashcard_decks            | monthly    | 0     | Fail             | N/A             | Fail            | Always fail     |
| anki_imports               | monthly    | 0     | Fail             | N/A             | Fail            | Always fail     |
| flashcard_daily_reviews    | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| stall_layout_customization | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_push                   | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_bg_sync                | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_periodic_sync          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_share_target           | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_fs_access              | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_badging                | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| pwa_media_session          | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| word_lookup                | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| news                       | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| story                      | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| books                      | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| kanji_mood_board           | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| drill                      | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| my_list                    | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| textbook_vocabulary        | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| flashcards                 | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |
| resources                  | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited       |
| blogs                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited       |
| vocabulary                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited       |
| comics                     | daily      | 0     | Fail             | N/A             | Fail            | Always fail     |

## free

| Feature                    | Limit Type | Limit | Usage=0          | Usage=limit-1   | Usage=limit     | Expected Result                 |
| -------------------------- | ---------- | ----- | ---------------- | --------------- | --------------- | ------------------------------- |
| hiragana_practice          | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| katakana_practice          | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| kanji_browser              | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| kanji_connection           | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| kanji_mastery              | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| drawing_practice           | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| custom_lists               | monthly    | 3     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| conjugation_drill          | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| grammar_explanations       | daily      | 3     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| youtube_shadowing          | daily      | 3     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| media_upload               | daily      | 2     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| save_items                 | monthly    | 50    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| todos                      | monthly    | 100   | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| flashcard_decks            | monthly    | 0     | Fail             | N/A             | Fail            | Always fail                     |
| anki_imports               | monthly    | 0     | Fail             | N/A             | Fail            | Always fail                     |
| flashcard_daily_reviews    | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| stall_layout_customization | daily      | 1     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| pwa_push                   | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_bg_sync                | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_periodic_sync          | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_share_target           | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_fs_access              | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_badging                | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| pwa_media_session          | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| word_lookup                | daily      | 15    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| news                       | daily      | 2     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| story                      | daily      | 2     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| books                      | daily      | 2     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| kanji_mood_board           | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| drill                      | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| my_list                    | daily      | 5     | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| textbook_vocabulary        | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| flashcards                 | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |
| resources                  | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| blogs                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| vocabulary                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| comics                     | daily      | 0     | Fail             | N/A             | Fail            | Always fail                     |

## premium_monthly

| Feature                    | Limit Type | Limit | Usage=0          | Usage=limit-1   | Usage=limit     | Expected Result                 |
| -------------------------- | ---------- | ----- | ---------------- | --------------- | --------------- | ------------------------------- |
| hiragana_practice          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| katakana_practice          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_browser              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_connection           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_mastery              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| drawing_practice           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| custom_lists               | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| conjugation_drill          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| grammar_explanations       | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| youtube_shadowing          | daily      | 20    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| media_upload               | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| save_items                 | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| todos                      | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| flashcard_decks            | monthly    | 15    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| anki_imports               | monthly    | 15    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| flashcard_daily_reviews    | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| stall_layout_customization | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_push                   | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_bg_sync                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_periodic_sync          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_share_target           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_fs_access              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_badging                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_media_session          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| word_lookup                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| news                       | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| story                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| books                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_mood_board           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| drill                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| my_list                    | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| textbook_vocabulary        | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| flashcards                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| resources                  | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| blogs                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| vocabulary                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| comics                     | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |

## premium_yearly

| Feature                    | Limit Type | Limit | Usage=0          | Usage=limit-1   | Usage=limit     | Expected Result                 |
| -------------------------- | ---------- | ----- | ---------------- | --------------- | --------------- | ------------------------------- |
| hiragana_practice          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| katakana_practice          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_browser              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_connection           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_mastery              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| drawing_practice           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| custom_lists               | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| conjugation_drill          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| grammar_explanations       | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| youtube_shadowing          | daily      | 20    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| media_upload               | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| save_items                 | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| todos                      | monthly    | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| flashcard_decks            | monthly    | 15    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| anki_imports               | monthly    | 15    | Pass             | Pass            | Fail            | Pass until limit, fail at limit |
| flashcard_daily_reviews    | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| stall_layout_customization | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_push                   | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_bg_sync                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_periodic_sync          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_share_target           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_fs_access              | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_badging                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| pwa_media_session          | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| word_lookup                | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| news                       | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| story                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| books                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| kanji_mood_board           | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| drill                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| my_list                    | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| textbook_vocabulary        | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| flashcards                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| resources                  | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| blogs                      | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| vocabulary                 | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
| comics                     | daily      | -1    | Pass (unlimited) | N/A (unlimited) | N/A (unlimited) | Unlimited                       |
