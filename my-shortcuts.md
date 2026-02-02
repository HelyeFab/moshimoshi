# My Prompt Shortcuts

> Personal command library for Claude conversations. Copy any block and paste into chat.

---

## Code Review

### `review-quick`
```
Review this code for bugs, security issues, and improvements. Be concise.
```

### `review-deep`
```
Do a thorough code review:
1. Security vulnerabilities (OWASP top 10)
2. Performance bottlenecks
3. Error handling gaps
4. Type safety issues
5. Suggest specific improvements with code examples
```

### `review-pr`
```
Review this PR. Focus on: breaking changes, test coverage gaps, and architectural concerns. Summarize in bullet points.
```

---

## Git & Commits

### `commit`
```
Generate a concise commit message for my staged changes. Use conventional commits format (feat/fix/refactor/docs/test/chore).
```

### `commit-detailed`
```
Generate a detailed commit message with:
- Subject line (50 chars max, imperative mood)
- Body explaining WHY, not what
- List breaking changes if any
```

### `changelog`
```
Generate changelog entries for recent commits. Group by: Added, Changed, Fixed, Removed.
```

---

## Debugging

### `debug`
```
Help me debug this issue. Ask clarifying questions first, then investigate systematically.
```

### `explain-error`
```
Explain this error message in plain English. What caused it? How do I fix it?
```

### `trace`
```
Trace the data flow for this feature. Show me the path from user action to database and back.
```

---

## Writing Code

### `implement`
```
Implement this feature following existing patterns in the codebase. Keep it simple, no over-engineering.
```

### `refactor`
```
Refactor this code for readability and maintainability. Preserve behavior exactly. Show before/after.
```

### `types`
```
Add proper TypeScript types to this code. Use strict typing, avoid 'any'.
```

### `test`
```
Write tests for this code. Cover: happy path, edge cases, error conditions. Use existing test patterns.
```

---

## Documentation

### `explain`
```
Explain this code like I'm a junior developer. What does it do and why?
```

### `document`
```
Add JSDoc comments to these functions. Include @param, @returns, @throws, @example.
```

---

## Performance

### `perf-audit`
```
Audit this code for performance issues. Look for: N+1 queries, unnecessary re-renders, memory leaks, blocking operations.
```

### `optimize`
```
Optimize this code for performance. Show benchmarks or explain the improvement.
```

---

## Project-Specific (Moshimoshi)

### `srs-check`
```
Review this SRS-related code against the SM-2+ algorithm spec. Verify interval calculations and state transitions.
```

### `adapter-new`
```
Create a new content adapter for the Review Engine. Follow the BaseContentAdapter pattern and register in AdapterRegistry.
```

### `validator-new`
```
Create a new validator for the Review Engine. Extend BaseValidator, implement fuzzy matching if needed.
```

### `offline-debug`
```
Debug this offline sync issue. Check: IndexedDB state, sync queue, circuit breaker status, conflict resolution.
```

---

## Quick Fixes

### `fix-lint`
```
Fix all linting errors in this file. Don't change logic, only formatting/style.
```

### `fix-types`
```
Fix TypeScript errors in this file. Explain each fix briefly.
```

### `simplify`
```
Simplify this code. Remove unnecessary complexity while keeping the same behavior.
```

---

## Meta

### `context`
```
Before we start: read the relevant files, understand the existing patterns, then propose an approach. Don't write code until I approve.
```

### `minimal`
```
Give me the minimal solution. No extra features, no future-proofing, just what I asked for.
```

### `tsc`
```
Run TypeScript type-check (tsc or npm run type-check) and fix any errors before moving on.
```

### `patterns`
```
Before writing any code, search the codebase for similar implementations. Follow existing patterns exactly. Don't reinvent the wheel.
```

### `options`
```
Give me 3 different approaches to solve this, with pros/cons for each. Let me choose.
```

---

*Add your own shortcuts below:*

## Custom

<!--
### `your-shortcut`
```
Your prompt here
```
-->
