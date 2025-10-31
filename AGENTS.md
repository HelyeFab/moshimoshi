# Repository Guidelines

## Project Structure & Module Organization
- Next.js app router features live in `src/app`; legacy API handlers stay in `src/pages/api`.
- Shared UI, hooks, services, and state management live across `src/components`, `src/hooks`, `src/lib`, `src/services`, `src/state`, and `src/stores`; styles are under `src/styles` and static assets in `public/`.
- Tests sit in `__tests__`, Firebase Cloud Functions in `functions/src`, configuration flags in `config/`, and project scripts (docs, streak guards, NotebookLM sync) in `scripts/`.

## Build, Test & Development Commands
- Bootstrap once with `npm install`.
- Run `npm run dev` for the full live loop (Next + NotebookLM) or `npm run dev:simple` for a lighter watcher.
- Produce and preview production output via `npm run build` followed by `npm start`.
- Quality gates: `npm run lint`, `npm run type-check`, `npm run test:unit`, `npm run test:review`, `npm run test:e2e`, and CI parity with `npm run test:ci`; merge coverage with `npm run coverage:report`.

## Coding Style & Naming Conventions
- Code is TypeScript-first; prefer `import type` for type-only dependencies and keep modules side-effect free for tree shaking.
- Default to two-space indentation, PascalCase components, hooks prefixed with `use`, camelCase utilities, and filenames mirroring exported symbols.
- Co-locate Tailwind utility styles with components, promoting only shared tokens into `src/styles`.

## Testing Guidelines
- Place Jest specs in `__tests__` using `<feature>.test.ts[x]`; reuse fixtures through `__tests__/mocks` to avoid duplication.
- Regenerate snapshots intentionally (`npm run test:unit -- -u`) and reference the change in review notes.
- Playwright covers e2e flows; keep scenarios in `__tests__/e2e`, stabilize them with MSW or Upstash mocks, and execute `npm run test:all` before large merges.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`) as seen in Git history, keeping scopes focused and imperative.
- PRs should state the problem, the solution, screenshots for UI updates, linked issues, and the command output from relevant tests.
- Separate deploy-impacting files (Firestore rules, `config/` toggles) into dedicated commits and update `docs/` or `README.md` when behavior shifts.

## Security & Configuration Tips
- Store secrets in `.env.local` for the app and `.env` under `functions/`; keep `firebase-admin-key.json` local only.
- After editing streak logic or rules, run `npm run ci:guard:streak` and review `firestore.rules` alongside `firestore.indexes.json`.
- Logging in `src/lib/logging` already scrubs sensitive fields—hash new identifiers before emitting metrics or traces.
