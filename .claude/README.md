# Guardian Scripts - AI Context Loaders

This directory contains guardian scripts that generate comprehensive context prompts for AI agents working on the Moshimoshi project.

## Available Guardians

### 1. `streak-guardian.sh`
**Purpose**: Load complete context for the Streak XP-Save feature implementation

**Usage**:
```bash
# From anywhere (if alias is set up):
streak-guardian

# Direct execution:
/path/to/moshimoshi/.claude/streak-guardian.sh

# Save to file:
streak-guardian /tmp/streak-context.md
```

**Output**: 549 lines of comprehensive context including:
- Streak feature architecture
- XP accumulation logic
- Auto-break refresh system
- Testing protocols
- Critical file locations
- Bug history and fixes

---

### 2. `enhancement-guardian.sh`
**Purpose**: Load complete context for the Security Enhancement & Modernization project

**Usage**:
```bash
# From anywhere (if alias is set up):
guardian-enhancement

# Direct execution:
/path/to/moshimoshi/.claude/enhancement-guardian.sh

# Save to file:
guardian-enhancement /tmp/enhancement-context.md
```

**Output**: 1,157 lines of comprehensive context including:
- YAML context (843 lines) - Structured project state
- Living Memory (top 100 lines) - Daily progress updates
- 11 security vulnerabilities documented
- 196 API routes analyzed
- Implementation checklist
- Critical file locations with line numbers

---

## Setup Instructions

### Option 1: Using Aliases (Recommended)

Add these lines to your `~/.zshrc` (or `~/.bashrc`):

```bash
alias streak-guardian='/path/to/moshimoshi/.claude/streak-guardian.sh'
alias guardian-enhancement='/path/to/moshimoshi/.claude/enhancement-guardian.sh'
```

Then reload your shell:
```bash
source ~/.zshrc
```

### Option 2: Direct Execution

The scripts are designed to work from **any directory** - they automatically find the project root:

```bash
cd /tmp
/home/beano/DevProjects/next_js/moshimoshi/.claude/streak-guardian.sh
# Works perfectly! ✅
```

---

## How It Works

### Dynamic Path Resolution

Both scripts use this pattern to work from any directory:

```bash
# Find project root automatically
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Reference files relative to project root
YAML_CONTEXT="$SCRIPT_DIR/security-enhancement-context.yml"
LIVING_MEMORY="$PROJECT_ROOT/docs/security-enhancement/IMPLEMENTATION_PROGRESS.md"
```

This means:
- ✅ Works from any directory
- ✅ Travels with the git repository
- ✅ No hardcoded paths
- ✅ Machine-independent

---

## Context System Architecture

### Streak Guardian

```
streak-guardian.sh
    ↓
Loads: streak-implementation-context.yml
    ↓
Generates: 549-line prompt with complete feature context
```

**Files Referenced**:
- `.claude/streak-implementation-context.yml` - Complete YAML context

---

### Enhancement Guardian

```
enhancement-guardian.sh
    ↓
Loads: security-enhancement-context.yml + IMPLEMENTATION_PROGRESS.md
    ↓
Generates: 1,157-line prompt with dual-context system
```

**Files Referenced**:
- `.claude/security-enhancement-context.yml` - Structured project state (843 lines)
- `docs/security-enhancement/IMPLEMENTATION_PROGRESS.md` - Living memory (updated daily)

**Dual-Context System**:
1. **YAML Context**: Machine-readable, comprehensive, stable reference
2. **Living Memory**: Human-readable, daily updates, evolving state

---

## When to Use Each Guardian

### Use `streak-guardian` when:
- Working on streak feature bugs
- Testing XP accumulation
- Debugging auto-break refresh
- Understanding streak logic

### Use `guardian-enhancement` when:
- Working on security fixes
- Implementing Phase 1-5 tasks
- Need complete vulnerability context
- Checking implementation progress

---

## Maintenance

### Updating Streak Context

Edit the YAML file:
```bash
vim .claude/streak-implementation-context.yml
```

The guardian script will automatically use the updated content.

---

### Updating Enhancement Context

1. **For structural changes**: Edit YAML
   ```bash
   vim .claude/security-enhancement-context.yml
   ```

2. **For daily progress**: Edit Living Memory
   ```bash
   vim docs/security-enhancement/IMPLEMENTATION_PROGRESS.md
   ```

The guardian script combines both files automatically.

---

## Migration from ~/.claude

These scripts were migrated from `~/.claude/` to the project repository to ensure:
- ✅ Scripts travel with the codebase
- ✅ Work on any machine
- ✅ Version controlled with git
- ✅ No machine-specific setup required

**Old location** (deprecated):
```bash
~/.claude/streak-guardian.sh          # ❌ Machine-specific
~/.claude/enhancement-guardian.sh     # ❌ Machine-specific
```

**New location** (current):
```bash
moshimoshi/.claude/streak-guardian.sh          # ✅ Repository
moshimoshi/.claude/enhancement-guardian.sh     # ✅ Repository
```

---

## Output Examples

### Streak Guardian Output Structure
```markdown
# STREAK GUARDIAN - MOSHIMOSHI IMPLEMENTATION CONTEXT

## Your Mission
[Context about streak feature...]

## Complete Implementation Context (from YAML)
```yaml
[Full YAML content...]
```

## Immediate Action Required
[Current testing status and next steps...]
```

### Enhancement Guardian Output Structure
```markdown
# ENHANCEMENT GUARDIAN - SECURITY & MODERNIZATION CONTEXT

## Your Mission
[Context about 9-week project...]

## Latest Status (from Living Memory)
[Top 100 lines of daily progress...]

## Complete Project Context (Structured YAML)
[Full 843 lines of YAML...]

## Immediate Action Required
[Current phase tasks and blockers...]
```

---

## Troubleshooting

### Script not found
```bash
# Make sure you're using the correct path
ls -la /path/to/moshimoshi/.claude/*.sh

# Ensure scripts are executable
chmod +x /path/to/moshimoshi/.claude/*.sh
```

### YAML file not found
```bash
# Scripts expect YAML files in the same directory
ls -la /path/to/moshimoshi/.claude/*.yml
```

### Alias not working
```bash
# Reload your shell configuration
source ~/.zshrc

# Or use direct path
/path/to/moshimoshi/.claude/streak-guardian.sh
```

---

## Future Guardians

When creating new guardian scripts for other features, follow this pattern:

1. **Create script**: `.claude/[feature]-guardian.sh`
2. **Create YAML**: `.claude/[feature]-implementation-context.yml`
3. **Add alias**: `alias guardian-[feature]='path/to/.claude/[feature]-guardian.sh'`
4. **Document**: Update this README

---

**Last Updated**: 2025-11-08
**Maintained By**: Development Team
**Version**: 2.0 (Project-local, machine-independent)
