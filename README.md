# Moshimoshi

Moshimoshi is a Japanese learning platform built on Next.js, blending spaced repetition drills, content aggregation, and automation tooling.

## Getting Started
- Install dependencies: `npm install`
- Launch the app with live sync tooling: `npm run dev`
- See `docs/` for feature-specific guides (e.g., `docs/time-machine`, `docs/ai`).

## Key Documentation
- **Streak System**: [`docs/STREAK_SYSTEM_INDEX_2025-10-30.md`](./docs/STREAK_SYSTEM_INDEX_2025-10-30.md) - Complete documentation hub for streak system architecture, migration guide, and comprehensive analysis
- **Security Enhancement**: [`docs/security-enhancement/README.md`](./docs/security-enhancement/README.md) - 9-week security & modernization project documentation

## AI Context Loaders (Guardian Scripts)
For AI agents working on this project, use the guardian scripts to load complete feature context:
- **Streak Feature**: `.claude/streak-guardian.sh` - Load complete streak implementation context
- **Security Enhancement**: `.claude/enhancement-guardian.sh` - Load 9-week modernization project context
- **Documentation**: [`.claude/README.md`](./.claude/README.md) - Complete guardian scripts usage guide

## Contributor Resources
- Review the full contributor playbook in [`AGENTS.md`](./AGENTS.md).
- Check `CLAUDE.md` for additional project background and planning requirements.

## License
This project is licensed under the ISC License.
