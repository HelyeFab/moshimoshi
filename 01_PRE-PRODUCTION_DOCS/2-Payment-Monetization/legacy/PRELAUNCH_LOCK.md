# Prelaunch Lock Manager

Manage the prelaunch lock and launch date across Vercel environments with a simple CLI tool.

## Quick Start

```bash
# Unlock production (will prompt to deploy)
./scripts/prelaunch-lock.sh --unlock-prod

# Lock production (will prompt to deploy)
./scripts/prelaunch-lock.sh --lock-prod

# Change launch date (all environments)
./scripts/prelaunch-lock.sh --set-date 2026-02-01

# Interactive mode
./scripts/prelaunch-lock.sh
```

## What It Does

Controls these environment variables across Vercel environments:

**Lock Variables:**
- `PRELAUNCH_LOCK_ENABLED` (server-side)
- `NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED` (client-side)

| Value | Effect |
|-------|--------|
| `true` | App is locked, shows waitlist page |
| `false` | App is unlocked, full access |

**Launch Date Variables:**
- `LAUNCH_DATE` (server-side)
- `NEXT_PUBLIC_LAUNCH_DATE` (client-side)

The launch date controls the countdown timer, badges, and automatic unlock timing.

## All Commands

### Lock Commands
| Command | Description |
|---------|-------------|
| `--unlock-prod` | Unlock production (prompts to deploy) |
| `--lock-prod` | Lock production (prompts to deploy) |
| `--unlock-dev` | Unlock development |
| `--lock-dev` | Lock development |
| `--unlock-all` | Unlock all environments |
| `--lock-all` | Lock all environments |

### Launch Date Commands
| Command | Description |
|---------|-------------|
| `--set-date DATE` | Set launch date for all environments (YYYY-MM-DD) |
| `--set-date-prod DATE` | Set launch date for production only |

### Other Commands
| Command | Description |
|---------|-------------|
| `--status` | Show current configuration |
| `--sync` | Sync production env vars to .env.local |
| `--deploy` | Deploy to production |
| `--no-deploy` | Skip deployment prompt |
| `--help` | Show help |

## Examples

```bash
# Unlock production and deploy
./scripts/prelaunch-lock.sh --unlock-prod

# Unlock production without deploying (for batch changes)
./scripts/prelaunch-lock.sh --unlock-prod --no-deploy

# Check current status
./scripts/prelaunch-lock.sh --status

# Post-launch: Unlock everything
./scripts/prelaunch-lock.sh --unlock-all

# Emergency: Lock everything
./scripts/prelaunch-lock.sh --lock-all

# Just deploy (no env changes)
./scripts/prelaunch-lock.sh --deploy

# Change launch date to February 1st, 2026
./scripts/prelaunch-lock.sh --set-date 2026-02-01

# Change launch date without deploying
./scripts/prelaunch-lock.sh --set-date 2026-02-01 --no-deploy
```

## Interactive Mode

Run without arguments for a menu-driven interface:

```bash
./scripts/prelaunch-lock.sh
```

Options include:
- **1-6**: Unlock/Lock individual environments
- **L**: Change launch date (all environments)
- **7**: Combo: Production LOCKED + Dev/Preview UNLOCKED (pre-launch setup)
- **8**: Combo: All UNLOCKED (post-launch)
- **9**: Combo: All LOCKED (emergency)

## Recommended Configurations

| Phase | Production | Preview | Development |
|-------|------------|---------|-------------|
| Pre-launch | `true` (locked) | `false` | `false` |
| Post-launch | `false` (unlocked) | `false` | `false` |
| Emergency | `true` (locked) | `true` | `true` |

## Notes

- **CRITICAL**: The script now automatically updates `.env.local` when changing launch dates
- Environment variable changes require a new deployment to take effect
- The script automatically prompts to deploy after production changes
- Use `--no-deploy` flag to skip the deployment prompt
- Use `--sync` to sync production env vars back to `.env.local` if they get out of sync
- Values are encrypted in Vercel - use `vercel env pull` to see actual values locally

## Troubleshooting

### Local and Production Out of Sync?

If your local `.env.local` shows a different date than production:

```bash
# Check current status
./scripts/prelaunch-lock.sh --status

# Sync production to local
./scripts/prelaunch-lock.sh --sync
```

This will pull the production `LAUNCH_DATE` and update your `.env.local` file.

## Related Documentation

- [Prelaunch Waitlist Implementation](./01_PRODUCTION_DOCS/PRELAUNCH_WAITLIST_IMPLEMENTATION.md)
