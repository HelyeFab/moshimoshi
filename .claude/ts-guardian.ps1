#
# TypeScript Error Guardian - Full Dynamic Prompt Generator
# Combines YAML context + live tracking data
#

$ProjectRoot = "C:\Users\esfab\WinDevProjects\moshimoshi"
$TrackingFile = "$ProjectRoot\docs\TYPESCRIPT_ERRORS_FILES.md"
$ContextFile = "$ProjectRoot\.claude\typescript-error-fixing-context.yml"

Push-Location $ProjectRoot

try {
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    # Parse tracking document
    $trackingContent = Get-Content $TrackingFile -Raw
    $fixedTotal = ([regex]::Matches($trackingContent, '\|\s*`[^`]+`\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|')).Count
    $fixedToday = ([regex]::Matches($trackingContent, "\|\s*``[^``]+``\s*\|\s*$today\s*\|")).Count
    $fixedYesterday = ([regex]::Matches($trackingContent, "\|\s*``[^``]+``\s*\|\s*$yesterday\s*\|")).Count

    # Get today's fixes
    $todayFixes = [regex]::Matches($trackingContent, "\|\s*``([^``]+)``\s*\|\s*$today\s*\|\s*([^|]+)\s*\|") | ForEach-Object {
        "| ``$($_.Groups[1].Value)`` | $($_.Groups[2].Value.Trim()) |"
    }

    # Progress
    $totalEstimated = 340
    $remaining = $totalEstimated - $fixedTotal
    $progressPct = [math]::Round(($fixedTotal / $totalEstimated) * 100, 1)

    # Generate the FULL prompt
    Write-Output @"
================================================================================
TYPESCRIPT ERROR GUARDIAN - FULL SESSION CONTEXT
================================================================================

Generated: $timestamp
Session Progress: $fixedTotal files fixed ($progressPct%) | $remaining remaining
Fixed Today: $fixedToday | Fixed Yesterday: $fixedYesterday

================================================================================
SECTION 1: DYNAMIC SESSION STATUS
================================================================================

## Progress Tracking

| Metric | Value |
|--------|-------|
| Files Fixed | $fixedTotal / ~$totalEstimated |
| Progress | $progressPct% complete |
| Remaining | ~$remaining files |
| Fixed Today | $fixedToday |
| Fixed Yesterday | $fixedYesterday |

"@

    if ($todayFixes.Count -gt 0) {
        Write-Output "## Files Fixed Today"
        Write-Output ""
        Write-Output "| File | Notes |"
        Write-Output "|------|-------|"
        $todayFixes | ForEach-Object { Write-Output $_ }
        Write-Output ""
    }

    Write-Output @"

================================================================================
SECTION 2: PROJECT OVERVIEW
================================================================================

## Project: Moshimoshi
Japanese learning platform with drills, reviews, gamification, and premium features.

## Tech Stack
- **Framework**: Next.js 15.5.2
- **Language**: TypeScript
- **Database**: Firebase/Firestore
- **Auth**: Firebase Auth + Custom JWT Sessions
- **Payments**: Stripe
- **State**: Zustand + React Query
- **Offline**: IndexedDB + Service Workers

## Task: TypeScript Error Remediation
**Goal**: Eliminate TypeScript errors while preserving existing behaviour
**Status**: IN PROGRESS
**Build Config**: ignoreBuildErrors: true (temporary)
**Error Tracking**: docs/TYPESCRIPT_ERRORS_FILES.md

================================================================================
SECTION 3: CORE PRINCIPLES
================================================================================

## DO:

### Understand Before Changing
- Read the function/module to understand its purpose
- Identify connections: imports, consumers, API routes, Firestore usage, hooks
- Read related files if necessary (shared types, services, hooks, converters)

### Preserve Behaviour
- Assume current runtime behaviour is intentional unless documented as a bug
- Refactor types in a way that keeps the same observable behaviour
- If tests exist, they should continue to pass

### Make Minimal Changes
- Prefer small, surgical fixes over large refactors
- Keep refactors well-scoped and well-reasoned
- Explain changes in comments or commit messages

### Use TypeScript Properly
- Narrow types with runtime guards
- Add proper interfaces and type definitions
- Use Firestore converters for typed collections
- Create API response types

### Be Explicit About Risk
- Add runtime checks for assumptions
- Comment assumptions and why they're safe

### Test Every Change
- Run type-check: npx tsc --noEmit
- Run tests if available: npm test
- Describe flows for manual smoke-testing

### Think App-Wide
- Ask: Who else imports this type/function?
- Ask: Does this change affect public APIs, shared models, or global state?
- Verify all usages when adjusting shared types

## DON'T:

### Blind Fixes
- Don't slap 'any' on values just to silence errors
- Don't add '!' non-null assertions without justification
- Don't cast everything to 'unknown' and back

### Change Business Logic
- Don't modify business rules
- Don't change entitlement logic
- Don't alter review engine behaviour
- Don't touch auth flows
- Don't modify payment/subscription logic
- Exception: Only if explicitly requested

### Break Shared Types
- Don't change public/shared types without checking all usages
- Don't introduce breaking changes without justification

================================================================================
SECTION 4: PREFERRED FIX PATTERNS
================================================================================

## Type Narrowing (Instead of Assertions)
``````typescript
// BAD
const user = data as User;

// GOOD
if (!data || typeof data.id !== 'string') {
  throw new Error('Invalid user data');
}
const user: User = data;
``````

## Optional Handling
``````typescript
// BAD
const name = user.profile!.name;

// GOOD
const name = user.profile?.name ?? 'Anonymous';
``````

## Runtime Guards
``````typescript
// BAD
return NextResponse.json({ data: result as any });

// GOOD
if (!result || !isValidResult(result)) {
  return NextResponse.json({ error: 'Invalid result' }, { status: 500 });
}
return NextResponse.json({ data: result });
``````

## Proper Interfaces
``````typescript
// BAD
const handleData = (data: any) => { ... }

// GOOD
interface UserData {
  id: string;
  email: string;
  profile?: UserProfile;
}
const handleData = (data: UserData) => { ... }
``````

## Firestore Converters
``````typescript
const userConverter: FirestoreDataConverter<User> = {
  toFirestore: (user: User) => ({ ...user }),
  fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as User
};
``````

================================================================================
SECTION 5: WORKFLOW PER ERROR
================================================================================

## Step 1: Identify the Error
- Copy the exact TypeScript error message(s)
- Note the file and line(s) involved

## Step 2: Understand the Context
- Describe what this piece of code is responsible for
- Identify dependencies: imported types/functions
- Note external services: Firestore, API routes, Auth, Stripe

## Step 3: Analyse Root Cause
Common causes:
- Missing or wrong type definition
- Optional value not handled
- Incorrect assumption about external data
- Mis-typed Firestore / API response
- Incorrect generic usage

## Step 4: Propose a Plan (Minimal and Safe)
Examples:
- Add a UserProfile interface and use it in this hook
- Narrow the type based on runtime checks
- Introduce a Firestore converter for this collection
- Make this prop optional and handle the undefined case

## Step 5: Implement the Fix
- Apply minimal code changes needed
- Avoid any or ! unless fully justified
- Keep logic identical; only typing/guards should change

## Step 6: Verify and Test
- Run TypeScript type-check
- Run tests
- Confirm no new errors introduced
- Suggest manual flows to smoke-test if relevant

## Step 7: Summarise Why the Fix is Safe
Example: "This change only adds stricter types and runtime checks; core logic, data shape, and behaviour remain unchanged."

## Step 8: Update the Error Tracking Document
- Open docs/TYPESCRIPT_ERRORS_FILES.md
- Add fixed file to the "Fixed Files" table with date and notes
- Update the count in the summary table
- Format: | ``src/path/to/file.ts`` | $today | Brief description |
- WHY: Prevents future agents from duplicating work on already-fixed files

================================================================================
SECTION 6: COMMON PATTERNS IN THIS CODEBASE
================================================================================

## SessionUser uses 'uid' not 'id'
``````typescript
// BAD
const userId = user.id

// GOOD
const userId = user.uid
``````

## adminDb Null Checks Required
``````typescript
// BAD
const doc = await adminDb.collection('users').doc(uid).get()

// GOOD
if (!adminDb) {
  return NextResponse.json({ error: 'Database not available' }, { status: 500 })
}
const doc = await adminDb.collection('users').doc(uid).get()
``````

## Error Typing in Catch Blocks
``````typescript
// BAD
} catch (error) {
  console.log(error.message)  // error is 'unknown'
}

// GOOD
} catch (error) {
  const err = error as Error & { code?: string }
  console.log(err.message)
}
``````

## API Route Pattern
``````typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/review/_middleware/auth';

export async function GET(request: NextRequest) {
  const { user, response: authError } = await requireAuth(request)
  if (authError) return authError

  const userId = user.uid  // NOT user.id

  if (!adminDb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Handler logic
  return NextResponse.json({ data });
}
``````

================================================================================
SECTION 7: COMMANDS
================================================================================

## PowerShell Commands

``````powershell
# Full type check (2-3 minutes)
npx tsc --noEmit

# Check specific file errors
npx tsc --noEmit 2>&1 | Select-String "filename"

# Count non-test errors
npx tsc --noEmit 2>&1 | Select-String "^src/.*error TS" | Where-Object { `$_ -notmatch "\.test\." } | Measure-Object

# Top files by error count
npx tsc --noEmit 2>&1 | Select-String "^src/.*error TS" | ForEach-Object { (`$_ -split '\(')[0] } | Group-Object | Sort-Object Count -Descending | Select-Object -First 15

# Dev server (errors show as warnings)
npm run dev
``````

================================================================================
SECTION 8: PROTECTED AREAS - DO NOT MODIFY
================================================================================

Unless explicitly requested, do NOT modify:
- Business rules and entitlement logic
- Payment/subscription flows (Stripe)
- Auth flows and session handling
- Review engine core algorithm (src/lib/review-engine/)
- Gamification XP/streak calculations
- YouTube extract route (core feature)

================================================================================
SECTION 9: SUCCESS CRITERIA
================================================================================

## Per Fix:
- Error is resolved
- No new errors introduced
- Tests still pass (if they exist)
- Behaviour is unchanged
- Fix is documented
- docs/TYPESCRIPT_ERRORS_FILES.md is updated

## Overall:
- Reduce error count progressively
- Priority files (Stripe) fixed first - DONE
- Admin routes fixed - DONE
- docs/TYPESCRIPT_ERRORS_FILES.md stays accurate
- Eventually set ignoreBuildErrors: false
- Clean production build

================================================================================
SECTION 10: ERROR TRACKING DOCUMENT
================================================================================

**CRITICAL**: After fixing any file, update docs/TYPESCRIPT_ERRORS_FILES.md

1. Add to the "Fixed Files" table:
   | ``src/path/to/file.ts`` | $today | Brief description of fix |

2. Remove from the pending files list (if present)

3. Update category counts in the Summary table

This prevents future sessions from duplicating work!

================================================================================
SESSION START
================================================================================

You are now fully briefed. Proceed with fixing TypeScript errors.

1. Check docs/TYPESCRIPT_ERRORS_FILES.md for pending files
2. Or run: npx tsc --noEmit 2>&1 | Select-String "error TS" | Select-Object -First 20
3. Follow the 8-step workflow for each error
4. Update the tracking document after each fix
5. Commit frequently with descriptive messages

**Current Priority**: API Routes (other) - ~42 remaining

================================================================================
"@

} finally {
    Pop-Location
}
