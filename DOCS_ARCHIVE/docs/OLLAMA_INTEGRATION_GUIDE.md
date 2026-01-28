# Ollama Integration Guide - Safe Migration

**Date:** 2025-01-17
**Status:** Ready for Testing
**Risk Level:** LOW (Full rollback capability)

---

## 🎯 Overview

This integration adds **Ollama (Qwen2.5:7b)** as an alternative AI provider to **reduce costs by 60-80%** while maintaining quality for Japanese learning tasks.

**Key Features:**
- ✅ **Zero risk** - All existing OpenAI code untouched
- ✅ **Instant rollback** - Change one env variable
- ✅ **Automatic fallback** - Falls back to OpenAI if Ollama fails
- ✅ **Gradual migration** - Enable/disable per task type

---

## 📁 New Files Added (Existing Code Unchanged)

```
src/lib/ai/
├── clients/
│   └── OllamaClient.ts              ← NEW: Ollama API client
├── config/
│   └── providers.ts                  ← NEW: Provider selection logic
└── processors/
    └── WordExplainerProcessorHybrid.ts  ← NEW: Example hybrid processor
```

**Existing files NOT modified:**
- ✅ `AIService.ts` - Unchanged
- ✅ `BaseProcessor.ts` - Unchanged
- ✅ `WordExplainerProcessor.ts` - Unchanged
- ✅ All other processors - Unchanged

---

## 🚀 How to Enable Ollama

### Step 1: Update `.env.local`

```bash
# Change these three lines:
AI_PROVIDER=ollama              # Was: openai
AI_PROVIDER_FALLBACK=openai     # Keep this
AI_OLLAMA_ENABLED=true          # Was: false
```

### Step 2: Update AIService to Use Hybrid Processors

In `src/lib/ai/AIService.ts`, change processor imports:

```typescript
// Before (OpenAI only):
import { WordExplainerProcessor } from './processors/WordExplainerProcessor';

// After (Hybrid - can use Ollama or OpenAI):
import { WordExplainerProcessorHybrid } from './processors/WordExplainerProcessorHybrid';
```

Then in `routeToProcessor()`:

```typescript
// Before:
case 'explain_word':
  return new WordExplainerProcessor(context).process(...);

// After:
case 'explain_word':
  return new WordExplainerProcessorHybrid(context).process(...);
```

### Step 3: Restart Your Dev Server

```bash
npm run dev
```

**That's it!** Ollama is now enabled.

---

## 🔄 How to Rollback (INSTANT)

### Option 1: Disable Ollama (Keep Code)

```bash
# In .env.local:
AI_PROVIDER=openai          # Switch back to OpenAI
AI_OLLAMA_ENABLED=false     # Disable Ollama
```

Restart server. **Done!** Back to 100% OpenAI.

### Option 2: Revert Code Changes

```typescript
// In AIService.ts, change back:
import { WordExplainerProcessor } from './processors/WordExplainerProcessor';

case 'explain_word':
  return new WordExplainerProcessor(context).process(...);
```

### Option 3: Delete New Files (Nuclear Option)

```bash
rm -rf src/lib/ai/clients/OllamaClient.ts
rm -rf src/lib/ai/config/providers.ts
rm -rf src/lib/ai/processors/*Hybrid.ts
```

---

## 🧪 Testing Plan

### Phase 1: Safe Testing (Current State)

```bash
# .env.local - Ollama DISABLED
AI_PROVIDER=openai
AI_OLLAMA_ENABLED=false
```

**Status:** Everything works exactly as before. No changes.

### Phase 2: Enable Ollama for One Task

```bash
# .env.local - Test with word explanations only
AI_PROVIDER=hybrid
AI_OLLAMA_ENABLED=true
```

**Test:**
1. Try explaining a word: "食べる"
2. Check response quality
3. Check response time
4. Monitor logs for "🤖 Using ollama"

**Rollback if needed:** Set `AI_PROVIDER=openai`

### Phase 3: Enable for All Tasks

```bash
# .env.local - Use Ollama by default
AI_PROVIDER=ollama
AI_OLLAMA_ENABLED=true
```

**Test all features:**
- [ ] Word explanations
- [ ] Grammar explanations
- [ ] Sentence grammar analysis
- [ ] Review question generation
- [ ] Story generation (admin)
- [ ] Transcript processing

### Phase 4: Production Deployment

After 1-2 weeks of testing:
1. Update production env vars
2. Monitor error rates
3. Monitor user feedback
4. Monitor Sheldon uptime

---

## 📊 Configuration Reference

### Environment Variables

| Variable | Options | Default | Description |
|----------|---------|---------|-------------|
| `AI_PROVIDER` | `openai` / `ollama` / `hybrid` | `openai` | Primary AI provider |
| `AI_PROVIDER_FALLBACK` | `openai` / `ollama` | `openai` | Fallback if primary fails |
| `AI_OLLAMA_ENABLED` | `true` / `false` | `false` | Enable Ollama integration |
| `OLLAMA_BASE_URL` | URL | `https://api.selfmind.dev/chat` | Sheldon Ollama endpoint |
| `OLLAMA_MODEL` | Model name | `qwen2.5:7b` | Ollama model to use |
| `OLLAMA_TIMEOUT` | Milliseconds | `60000` | Request timeout |
| `OLLAMA_MAX_RETRIES` | Number | `2` | Retry attempts |

### Provider Modes

**`openai` mode:**
- Uses only OpenAI
- Ollama is disabled
- Safe default

**`ollama` mode:**
- Uses only Ollama
- Falls back to OpenAI if Sheldon is down
- Maximum cost savings

**`hybrid` mode:**
- Smart routing based on task type
- Critical tasks → OpenAI
- Bulk tasks → Ollama
- Balanced approach

---

## 🔍 Monitoring & Logs

### Check Which Provider is Being Used

```bash
# Look for these logs:
🤖 Using openai for word explanation: 食べる
🤖 Using ollama for word explanation: 食べる
```

### Check Ollama Health

```bash
# In browser console or server logs:
✅ Provider ollama recovered
⚠️ Provider ollama marked as unhealthy
```

### Check Fallback Behavior

```bash
# When Ollama fails:
❌ ollama failed: [error details]
⚠️ Falling back to openai
```

---

## 💰 Expected Cost Savings

### Current Costs (OpenAI Only)

```
Assuming 10,000 requests/month:
- Word explanations: 3,000 requests × $0.002 = $6
- Grammar explanations: 3,000 requests × $0.003 = $9
- Review questions: 2,000 requests × $0.004 = $8
- Story generation: 100 requests × $0.60 = $60
- Transcripts: 1,900 requests × $0.005 = $9.50

Total: ~$92.50/month = $1,110/year
```

### With Ollama (80% migration)

```
- Word explanations: FREE (Ollama)
- Grammar explanations: FREE (Ollama)
- Review questions: FREE (Ollama)
- Story generation: FREE (Ollama)
- Transcripts: FREE (Ollama)
- OpenAI fallback: ~$18.50/month (20% fallback rate)

Total: ~$18.50/month = $222/year

Savings: $888/year (80% reduction)
```

---

## 🐛 Troubleshooting

### Issue: "Ollama client not initialized"

**Solution:** Check `AI_OLLAMA_ENABLED=true` in `.env.local`

### Issue: All requests using OpenAI instead of Ollama

**Check:**
1. `AI_PROVIDER=ollama` in env
2. `AI_OLLAMA_ENABLED=true` in env
3. Server restarted after env changes
4. Using hybrid processor (not original)

### Issue: Slow responses

**Optimize:**
1. Reduce `num_predict` in prompts
2. Use shorter system prompts
3. Check Sheldon server load

### Issue: Quality worse than OpenAI

**Solutions:**
1. Adjust temperature (lower = more factual)
2. Improve prompt engineering
3. Fallback to OpenAI for that task type
4. Update routing in `providers.ts`

---

## 📈 Success Metrics

### Week 1-2: Testing Phase
- [ ] Zero production errors
- [ ] Response time < 15s for 95% of requests
- [ ] Quality rating ≥ 4/5 from users
- [ ] Ollama uptime > 99%

### Month 1: Early Adoption
- [ ] 50% of requests using Ollama
- [ ] Cost reduction ≥ 40%
- [ ] User satisfaction maintained
- [ ] <5 Sheldon downtime incidents

### Month 3: Full Migration
- [ ] 80% of requests using Ollama
- [ ] Cost reduction ≥ 70%
- [ ] OpenAI only for fallback
- [ ] Documented best practices

---

## 🎯 Next Steps

### Immediate (This Week)
1. [x] Create Ollama client
2. [x] Create provider configuration
3. [x] Create hybrid processor example
4. [ ] Test locally with one task type
5. [ ] Verify rollback works

### Short Term (Next 2 Weeks)
1. [ ] Create hybrid versions of all processors
2. [ ] Add monitoring/analytics
3. [ ] Test all features thoroughly
4. [ ] Document any quality differences

### Long Term (Next Month)
1. [ ] Deploy to production with feature flag
2. [ ] Monitor cost savings
3. [ ] A/B test quality vs OpenAI
4. [ ] Optimize prompts for Ollama
5. [ ] Consider Qwen3-VL for vision tasks

---

## 🆘 Emergency Rollback Checklist

If something goes wrong in production:

1. ✅ **Immediate:** Set `AI_PROVIDER=openai` in production env
2. ✅ **Redeploy** or restart server
3. ✅ **Verify** all requests using OpenAI
4. ✅ **Monitor** error rates return to normal
5. ✅ **Document** what went wrong
6. ✅ **Fix** issue before re-enabling

**Rollback time:** < 5 minutes

---

## 📞 Support

**Questions?** Check:
1. This guide
2. `/home/beano/Life-Org/SecondBrain/Sheldon/APIs/08-chat-llm-ollama-api.md`
3. Sheldon API Dashboard: https://guardian-dashboard.appsparkle.org

**Issues?**
- Sheldon uptime issues → Check Guardian Dashboard
- Ollama performance issues → Check server load
- Quality issues → Adjust prompts/temperature

---

**Last Updated:** 2025-01-17
**Version:** 1.0.0
**Status:** Ready for Testing ✅
