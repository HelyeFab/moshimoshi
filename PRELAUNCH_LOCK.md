# Prelaunch Lock Manager

Manage the prelaunch lock across Vercel environments with a simple CLI tool.

## Quick Start

```bash
# Unlock production (will prompt to deploy)
./scripts/prelaunch-lock.sh --unlock-prod

# Lock production (will prompt to deploy)
./scripts/prelaunch-lock.sh --lock-prod

# Interactive mode
./scripts/prelaunch-lock.sh
```

## What It Does

Controls these environment variables across Vercel environments:
- `PRELAUNCH_LOCK_ENABLED` (server-side)
- `NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED` (client-side)

| Value | Effect |
|-------|--------|
| `true` | App is locked, shows waitlist page |
| `false` | App is unlocked, full access |

## All Commands

| Command | Description |
|---------|-------------|
| `--unlock-prod` | Unlock production (prompts to deploy) |
| `--lock-prod` | Lock production (prompts to deploy) |
| `--unlock-dev` | Unlock development |
| `--lock-dev` | Lock development |
| `--unlock-all` | Unlock all environments |
| `--lock-all` | Lock all environments |
| `--status` | Show current configuration |
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
```

## Interactive Mode

Run without arguments for a menu-driven interface:

```bash
./scripts/prelaunch-lock.sh
```

Options include:
1. Unlock/Lock individual environments
2. Combo: Production LOCKED + Dev/Preview UNLOCKED (pre-launch setup)
3. Combo: All UNLOCKED (post-launch)
4. Combo: All LOCKED (emergency)

## Recommended Configurations

| Phase | Production | Preview | Development |
|-------|------------|---------|-------------|
| Pre-launch | `true` (locked) | `false` | `false` |
| Post-launch | `false` (unlocked) | `false` | `false` |
| Emergency | `true` (locked) | `true` | `true` |

## Notes

- Environment variable changes require a new deployment to take effect
- The script automatically prompts to deploy after production changes
- Use `--no-deploy` flag to skip the deployment prompt
- Values are encrypted in Vercel - use `vercel env pull` to see actual values locally

## Related Documentation

- [Prelaunch Waitlist Implementation](./01_PRODUCTION_DOCS/PRELAUNCH_WAITLIST_IMPLEMENTATION.md)
