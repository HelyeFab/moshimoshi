# Feature Migration Prompt - Doshi Sensei to Target Project

## Mission
Extract the specified feature from the doshi-sensei codebase as a pure, standalone functionality module, removing ALL access control, authentication, entitlement, and usage tracking layers.

## Core Principles

### KEEP (✅)
- Core feature UI components and their styling
- Business logic and algorithms
- Data processing and transformation functions
- API integration logic (Wanikani, JMdict, OpenAI, etc.)
- Local data access and search functionality
- Display/presentation components
- Feature-specific utilities and helpers
- Type definitions and interfaces (minus auth-related fields)
- Feature-specific state management
- Error handling for technical issues (API failures, data issues)
- Loading states and user feedback mechanisms
- Feature configuration that affects functionality (not access)

### REMOVE (❌)
- All `useAuth()` and `useUser()` hooks and their checks
- All `checkFeatureAccess()` and similar permission checks
- All Firebase Analytics tracking (`logEvent`, `incrementStat`, etc.)
- All usage counters and daily limit checks
- All subscription/premium/tier conditionals
- All `isGuest`, `isPremium`, `isFree` user type checks
- All usage tracking in IndexedDB/localStorage
- All entitlement-related UI (upgrade prompts, limit warnings)
- All Firebase Auth dependencies (unless needed for data storage)
- All references to the Three-Pillar Architecture
- All feature flags based on user tier
- All paywall components and upgrade CTAs
- All usage statistics collection
- Error messages about limits or permissions

## Migration Steps

### Step 1: Analyze Dependencies
1. Map all imports and dependencies for the feature
2. Identify which are core to functionality vs. access control
3. List third-party libraries that must be carried over
4. Note any shared utilities that need to be extracted

### Step 2: Extract Core Components
1. Copy the main feature component(s)
2. Remove all conditional rendering based on user tier
3. Remove all usage tracking calls
4. Replace auth-gated sections with unconditional rendering
5. Remove upgrade prompts and limit warnings

### Step 3: Clean Business Logic
1. Remove all early returns based on user permissions
2. Remove usage increment calls
3. Remove limit checks from loops and operations
4. Make all feature paths accessible by default
5. Remove premium-only feature branches

### Step 4: Simplify Data Access
1. Remove user-scoped data filtering (unless functionally required)
2. Remove permission checks on data operations
3. Keep core CRUD operations intact
4. Preserve data validation that's about data integrity (not access)

### Step 5: Update Types and Interfaces
1. Remove auth-related fields from interfaces
2. Remove user tier enums and types
3. Keep functional types and data structures
4. Simplify props by removing permission-related ones

### Step 6: Handle External Services
1. Keep API keys and service configurations as environment variables
2. Remove API call limits based on user tier
3. Keep rate limiting that's about service stability
4. Preserve error handling for service failures

## Code Transformation Examples

### Before (with access control):
```typescript
const SearchComponent = () => {
  const { user, isGuest } = useAuth();
  const { checkFeatureAccess } = useFeatureAccess();
  
  const handleSearch = async (query: string) => {
    if (!checkFeatureAccess('word_search')) {
      showUpgradePrompt();
      return;
    }
    
    await incrementUsage('word_search');
    
    if (isGuest && dailySearches >= 10) {
      alert('Daily limit reached. Please sign up!');
      return;
    }
    
    const results = await searchWords(query);
    logEvent('word_search_performed', { query, resultCount: results.length });
    return results;
  };
};
```

### After (pure functionality):
```typescript
const SearchComponent = () => {
  const handleSearch = async (query: string) => {
    const results = await searchWords(query);
    return results;
  };
};
```

## Feature-Specific Considerations

### For API-based features:
- Keep the API integration logic
- Remove per-user API quotas
- Keep service-level rate limiting
- Preserve API key management

### For data-heavy features:
- Keep data loading and caching logic
- Remove user-specific data filtering (unless functional)
- Preserve performance optimizations
- Keep pagination/virtualization

### For interactive features:
- Keep all interaction logic
- Remove interaction limits
- Preserve state management
- Keep animation and transitions

### For AI/ML features:
- Keep model integration
- Remove usage quotas
- Preserve prompt engineering
- Keep response processing

## Output Structure

```
/migrated-feature-name/
├── components/          # UI components (cleaned)
├── hooks/              # Feature-specific hooks (no auth)
├── utils/              # Helper functions (pure)
├── services/           # API/data services (no tracking)
├── types/              # Type definitions (no auth types)
├── data/               # Static data if needed
└── README.md           # Setup and usage instructions
```

## Final Checklist

- [ ] No authentication checks remain
- [ ] No usage tracking code remains
- [ ] No tier-based conditionals remain
- [ ] No Firebase Analytics calls remain
- [ ] No upgrade prompts or paywalls remain
- [ ] Feature works without any user context
- [ ] All core functionality is preserved
- [ ] Dependencies are documented
- [ ] Environment variables are listed
- [ ] Clean, framework-agnostic where possible

## Testing the Migration

1. Feature should work without any user login
2. No console errors about missing auth context
3. All feature paths are accessible
4. No UI elements mentioning limits or upgrades
5. Core functionality matches original (minus restrictions)

## Note to Agent
Focus ONLY on extracting the pure feature. The target application will handle its own authentication, authorization, and usage tracking. Your job is to provide clean, unrestricted functionality that can be wrapped with any access control system.