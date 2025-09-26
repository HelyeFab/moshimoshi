# Repository Guidelines

## Project Structure & Module Organization
The Next.js client lives in `src/app` with legacy pages in `src/pages`. Shared UI sits in `src/components`, domain logic in `src/lib` and `src/services`, state in `src/stores`, and reusable helpers in `src/hooks` and `src/utils`. Static assets live in `public/`; docs, scripts, and Firebase resources live in `docs/`, `scripts/`, `config/`, and `functions/`. Repository-level integration harnesses live in `__tests__/`, front-end suites stay in `src/__tests__/`, and end-to-end flows run from `tests/`.

## Build, Test, and Development Commands
- `npm run dev` starts Next with the NotebookLM watcher; use `npm run dev:simple` when syncing is unnecessary.
- `npm run build` produces a production bundle, and `npm run start` serves it.
- `npm run lint` enforces the Next/ESLint ruleset before commits.
- `npm run type-check` validates the TypeScript surface without emitting files.
- `npm run test`, `npm run test:unit`, and `npm run test:e2e` run Jest units and Playwright suites; `npm run test:ci` aggregates coverage for pipelines.

## Coding Style & Naming Conventions
Write TypeScript React components (`.tsx`) with a 2-space indent. Use PascalCase for components and stores, camelCase for hooks and utilities, and pluralize directories only when they hold peers (e.g., `stores/`, `services/`). Favor functional components, explicit props interfaces, and Tailwind-first class names; custom CSS should live in `src/styles/`. Run `npm run lint` before pushing to align with the ESLint and Tailwind plugins.

## Testing Guidelines
Name Jest specs `*.test.ts[x]` in `src/__tests__/` for UI work and in repo-level `__tests__/` for scripts. Use Playwright projects in `tests/e2e/` for browser coverage and keep fixtures under `tests/integration/`. `npm run test:coverage` merges unit and review-engine reports into `coverage/combined`; flag regressions in PRs so reviewers can chase missing assertions.

## Commit & Pull Request Guidelines
Follow the conventional commit style visible in recent history (`feat:`, `fix:`, `chore:`). Keep subjects under ~72 chars, add a scope when it clarifies impact, and describe behavior changes in the body. PRs should link issues or Linear tickets, list manual test commands, and include UI screenshots when visuals change. Confirm lint, type-check, and relevant tests pass before assigning reviewers.

## Security & Configuration Tips
Secrets stay in `.env.local` and `.env.production.local`. Reference Firebase, Redis, and webhook settings from `config/` and `functions/` instead of duplicating keys. Before running `start-all-webhooks.sh` or `sync-time-machine.sh`, confirm credentials and target environment. Update CORS policies by editing `cors.json` and executing `./apply-cors.sh`.
