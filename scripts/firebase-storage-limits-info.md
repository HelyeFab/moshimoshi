# Firebase Storage Limits

## Your Storage Bucket
`moshimoshi-de237.firebasestorage.app`

## Firebase Plans & Storage Limits

### Spark Plan (FREE)
- **Storage**: 5 GB total
- **Downloads**: 1 GB/day
- **Uploads**: 1 GB/day
- **Cost**: $0

### Blaze Plan (PAY-AS-YOU-GO)
- **Storage**: UNLIMITED (pay $0.026/GB/month after 5 GB free)
- **Downloads**: UNLIMITED (pay $0.12/GB after 1 GB/day free)
- **Uploads**: UNLIMITED (pay $0.12/GB after 1 GB/day free)
- **Cost**: Pay only for what you use

## Your Current Situation

### Existing Deck (400 cards)
- Media: ~21.5 MB (642 files)
- Status: ✅ Well within limits

### New Deck (4,152 cards - if imported)
Based on 106 MB file size:
- Estimated media: ~100 MB
- Total with existing: ~121.5 MB
- Status: ✅ Well within 5 GB limit

### Multiple Large Decks
If you imported 10 similar large decks:
- Total media: ~1 GB
- Status: ✅ Still within free 5 GB limit

## Answer to Your Question

**YES, there ARE quota limits in Firebase Storage:**

**FREE (Spark Plan):**
- ✅ 5 GB total storage
- ✅ 1 GB/day downloads
- ✅ 1 GB/day uploads

**PAID (Blaze Plan):**
- ✅ Unlimited (but you pay per GB)
- Much higher limits on free tier (5 GB storage, 1 GB/day transfer)

## For Your 4,152-card Deck

Even if we could store the cards in Firestore (hypothetically):

1. **Media files**: ~100 MB → Firebase Storage
2. **Would hit quota**: NO ❌ (you have 5 GB on free plan)
3. **Cost on free plan**: $0 (way under 5 GB limit)
4. **Cost on Blaze plan**: ~$0.003/month (100 MB × $0.026/GB)

## Bottom Line

**Firebase Storage is NOT the problem.**

You could store hundreds of these decks before hitting the 5 GB free limit.

**Firestore document size IS the problem** (1 MB per document).

That's why we need to refactor to store cards separately from the deck metadata.
