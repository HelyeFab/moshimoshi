# Archived Scrapers

This directory contains scrapers that have been archived for potential future use.

## Archived on: 2024-11-24

### Files:
- `mainichi-news.ts` - Scraper for Mainichi News (mainichi.jp) - N2 level content
- `mainichi-shogakusei.ts` - Scraper for Mainichi Elementary (mainichi.jp/maisho/) - N5 level content

### Reason for archival:
These scrapers were removed from active use as requested but preserved for potential future reactivation.

### To reactivate:
1. Move the desired scraper back to `functions/src/scrapers/`
2. Add import and case statement back to `newsScheduler.ts`
3. Add source configuration back to `NEWS_SOURCES` array
4. Test and deploy

### Original functionality:
Both scrapers included:
- HTML parsing with multiple fallback selectors
- TTS audio generation (title, summary, content)
- Photo caption removal
- Japanese date parsing
- Firestore batch storage