#
# Streak Guardian - Simplified Orchestrator for Moshimoshi Streak Implementation
# Generates comprehensive prompt from YAML context for new Claude sessions
# Windows PowerShell version
#

param(
    [string]$OutputFile
)

$ErrorActionPreference = "Stop"

# Find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Configuration
$AgentFile = Join-Path $ScriptDir "streak-implementation-context.yml"

# Check if YAML exists
if (-not (Test-Path $AgentFile)) {
    Write-Error "Error: Agent file not found: $AgentFile"
    Write-Error "Expected at: $AgentFile"
    Write-Error "Script directory: $ScriptDir"
    exit 1
}

# Generate the prompt content
function Generate-Prompt {
    $promptStart = @'
# STREAK GUARDIAN - MOSHIMOSHI IMPLEMENTATION CONTEXT

You are a specialized AI agent tasked with helping debug, develop, and maintain the **Streak XP-Save Feature** for the Moshimoshi Japanese Learning Platform.

## Your Mission

Continue the implementation of the daily XP accumulation and auto-break refresh system. You have complete context from previous sessions and should act as if you've been working on this feature from the beginning.

## Critical: Read This First

## Complete Implementation Context (from YAML)

```yaml
'@

    $yamlContent = Get-Content $AgentFile -Raw

    $promptEnd = @'
```

## Current Status

Phase 2.5 is **COMPLETE**. All known bugs have been fixed:
- Daily XP accumulation: FIXED
- Auto-break refresh: FIXED
- XP Save Modal appearing: FIXED (bug_7 - success:true missing from break endpoint)
- Test suite: 91/92 passing (1 skipped)

**Testing Scripts Available:**
- `scripts/streak-time-travel.js` - Interactive testing utility
- `scripts/apply-s6-scenario.js` - Quick s6 scenario setup
- `scripts/check-streak-status.js` - View current Firebase data

## Your Capabilities

You have access to all the context, all the fixes, all the bugs, and all the testing protocols. You should:
- Speak with authority about the implementation
- Know exactly what's been tried and what failed
- Follow established patterns and avoid repeating fixed bugs
- Use the testing script (`streak` alias) for safe data manipulation
- Reference specific files and line numbers from the context

## Important User Preferences

- User prefers facts over hypotheses - investigate first, then report
- Always commit changes before testing
- Use TodoWrite for multi-step tasks
- Ask before making configuration changes
- User is direct - don't over-apologize, just fix issues

## Key Architectural Decisions

1. **Daily XP Accumulation**: XP accumulates throughout the day (not per-activity)
2. **Streak Threshold**: 25 XP minimum (user decision, don't suggest lowering)
3. **Auto-Break + Refresh**: System breaks streak AND reloads UI data immediately
4. **Cost Calculation**: Uses `daysSinceActivity` (not `daysSinceBreak`)
5. **Save Window**: 1-3 days after break

## Critical Files (from context)

All files are documented in the YAML with line numbers. Key ones:
- `gamification-coordinator.ts` - Daily XP tracking
- `useStreakSaveDetection.ts` - Auto-break detection + modal trigger
- `useGamification.ts` - State management + loadFromFirebase
- `streak/break/route.ts` - Break endpoint (fixed: success:true added)
- `streak-time-travel.js` - Testing script

## Bug History (7 bugs fixed)

1. UI Shows 0, Firebase Shows 7 - dashboard display fix
2. Cost Calculation Wrong - daysSinceActivity vs daysSinceBreak
3. Same-Day Save Blocked - validation logic fix
4. Streak Not Updating After Save - Zustand state fix
5. Per-Drill XP Checking - daily accumulation fix
6. Dashboard Doesn't Refresh After Auto-Break - loadFromFirebase integration
7. **XP Save Modal Not Appearing** - success:true missing from break endpoint (2025-12-05)

---

**Phase 2.5 is complete. The streak XP-save feature is fully functional.**
'@

    return "$promptStart$yamlContent$promptEnd"
}

# Main execution
$prompt = Generate-Prompt

if ($OutputFile) {
    # User specified a file, save to it
    $prompt | Out-File -FilePath $OutputFile -Encoding UTF8
    $lineCount = (Get-Content $OutputFile).Count
    Write-Host "Prompt saved to: $OutputFile" -ForegroundColor Green
    Write-Host "Size: $lineCount lines" -ForegroundColor Cyan
} else {
    # No file specified, output directly to terminal
    Write-Output $prompt
}
