#
# TypeScript Error Guardian - Dynamic PowerShell Version
# Generates comprehensive prompt with LIVE error counts and session progress
#

param(
    [string]$OutputFile,
    [switch]$SkipTsc,      # Skip running tsc (faster, uses cached data)
    [switch]$Verbose
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AgentFile = Join-Path $ScriptDir "typescript-error-fixing-context.yml"
$ErrorTrackingFile = Join-Path $ProjectRoot "docs\TYPESCRIPT_ERRORS_FILES.md"
$SessionLogFile = Join-Path $ScriptDir "typescript-session-log.json"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Get-LiveErrorCount {
    <#
    .SYNOPSIS
    Runs tsc --noEmit and returns error statistics
    #>
    Write-Host "Running TypeScript compiler (this may take 2-3 minutes)..." -ForegroundColor Yellow

    $startTime = Get-Date
    $tempFile = [System.IO.Path]::GetTempFileName()

    try {
        # Run tsc and redirect to temp file (faster than piping)
        $proc = Start-Process -FilePath "npx" -ArgumentList "tsc", "--noEmit" -NoNewWindow -Wait -RedirectStandardOutput $tempFile -RedirectStandardError "$tempFile.err" -PassThru
        $duration = (Get-Date) - $startTime

        # Read output from temp file
        $tscOutput = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
        if (Test-Path "$tempFile.err") {
            $tscOutput += Get-Content "$tempFile.err" -Raw -ErrorAction SilentlyContinue
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        Remove-Item "$tempFile.err" -ErrorAction SilentlyContinue
    }

    # Count errors (excluding test files and .next/types)
    $errorLines = $tscOutput -split "`n" | Where-Object {
        $_ -match "^src/.*error TS" -and
        $_ -notmatch "\.test\." -and
        $_ -notmatch "\.spec\." -and
        $_ -notmatch "__tests__"
    }

    $totalErrors = $errorLines.Count

    # Get unique files with errors
    $filesWithErrors = $errorLines | ForEach-Object {
        if ($_ -match "^(src/[^(]+)") {
            $Matches[1].Trim()
        }
    } | Sort-Object -Unique

    $fileCount = $filesWithErrors.Count

    # Get top 10 files by error count
    $topFiles = $errorLines | ForEach-Object {
        if ($_ -match "^(src/[^(]+)") {
            $Matches[1].Trim()
        }
    } | Group-Object | Sort-Object Count -Descending | Select-Object -First 10

    Write-Host "Completed in $($duration.TotalSeconds.ToString('F1'))s" -ForegroundColor Green

    return @{
        TotalErrors = $totalErrors
        FileCount = $fileCount
        TopFiles = $topFiles
        Duration = $duration.TotalSeconds
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

function Get-FixedFilesFromTrackingDoc {
    <#
    .SYNOPSIS
    Parses the tracking document to extract fixed files with dates
    #>
    if (-not (Test-Path $ErrorTrackingFile)) {
        return @()
    }

    $content = Get-Content $ErrorTrackingFile -Raw
    $fixedFiles = @()

    # Parse the Fixed Files table (format: | `file` | date | notes |)
    $tablePattern = '\|\s*`([^`]+)`\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]*)\s*\|'
    $matches = [regex]::Matches($content, $tablePattern)

    foreach ($match in $matches) {
        $fixedFiles += @{
            File = $match.Groups[1].Value
            Date = $match.Groups[2].Value
            Notes = $match.Groups[3].Value.Trim()
        }
    }

    return $fixedFiles
}

function Get-RecentFixes {
    <#
    .SYNOPSIS
    Gets files fixed in recent sessions (today, yesterday, this week)
    #>
    param([array]$FixedFiles)

    $today = (Get-Date).ToString("yyyy-MM-dd")
    $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $weekAgo = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")

    $todayFixes = $FixedFiles | Where-Object { $_.Date -eq $today }
    $yesterdayFixes = $FixedFiles | Where-Object { $_.Date -eq $yesterday }
    $weekFixes = $FixedFiles | Where-Object { $_.Date -ge $weekAgo }

    return @{
        Today = $todayFixes
        Yesterday = $yesterdayFixes
        ThisWeek = $weekFixes
        Total = $FixedFiles.Count
    }
}

function Get-SessionLog {
    <#
    .SYNOPSIS
    Reads the session log file for historical progress
    #>
    if (Test-Path $SessionLogFile) {
        try {
            return Get-Content $SessionLogFile -Raw | ConvertFrom-Json
        } catch {
            return @{ Sessions = @() }
        }
    }
    return @{ Sessions = @() }
}

function Save-SessionLog {
    <#
    .SYNOPSIS
    Saves current session data to the log file
    #>
    param($ErrorStats, $FixedCount)

    $log = Get-SessionLog

    $newSession = @{
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        ErrorCount = $ErrorStats.TotalErrors
        FileCount = $ErrorStats.FileCount
        FixedTotal = $FixedCount
    }

    # Keep last 20 sessions
    $sessions = @($log.Sessions) + @($newSession)
    if ($sessions.Count -gt 20) {
        $sessions = $sessions[-20..-1]
    }

    @{ Sessions = $sessions } | ConvertTo-Json -Depth 5 | Set-Content $SessionLogFile -Encoding UTF8
}

function Get-ProgressTrend {
    <#
    .SYNOPSIS
    Calculates progress trend from session history
    #>
    $log = Get-SessionLog
    $sessions = @($log.Sessions)

    if ($sessions.Count -lt 2) {
        return $null
    }

    $latest = $sessions[-1]
    $previous = $sessions[-2]

    return @{
        ErrorsDelta = $latest.ErrorCount - $previous.ErrorCount
        FilesDelta = $latest.FileCount - $previous.FileCount
        FixedDelta = $latest.FixedTotal - $previous.FixedTotal
        PreviousTimestamp = $previous.Timestamp
    }
}

function Get-NextPriorityFiles {
    <#
    .SYNOPSIS
    Suggests next files to work on based on category priority
    #>
    param([array]$TopFilesWithErrors)

    # Priority order: API routes > hooks > lib > components > pages
    $priorityOrder = @{
        "src/app/api/" = 1
        "src/hooks/" = 2
        "src/lib/" = 3
        "src/components/" = 4
        "src/app/" = 5
    }

    $prioritized = $TopFilesWithErrors | ForEach-Object {
        $file = $_.Name
        $priority = 10  # default
        foreach ($pattern in $priorityOrder.Keys) {
            if ($file.StartsWith($pattern)) {
                $priority = $priorityOrder[$pattern]
                break
            }
        }
        @{
            File = $file
            ErrorCount = $_.Count
            Priority = $priority
        }
    } | Sort-Object Priority, @{Expression={$_.ErrorCount}; Descending=$true}

    return $prioritized | Select-Object -First 5
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Check prerequisites
if (-not (Test-Path $AgentFile)) {
    Write-Error "Agent file not found: $AgentFile"
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TypeScript Error Guardian (Dynamic)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get live error statistics (or skip if requested)
$errorStats = $null
if (-not $SkipTsc) {
    $errorStats = Get-LiveErrorCount
} else {
    Write-Host "Skipping tsc (using cached data if available)" -ForegroundColor Yellow
    $log = Get-SessionLog
    if ($log.Sessions.Count -gt 0) {
        $lastSession = $log.Sessions[-1]
        $errorStats = @{
            TotalErrors = $lastSession.ErrorCount
            FileCount = $lastSession.FileCount
            TopFiles = @()
            Timestamp = $lastSession.Timestamp
            Cached = $true
        }
    }
}

# Get fixed files from tracking document
$fixedFiles = Get-FixedFilesFromTrackingDoc
$recentFixes = Get-RecentFixes -FixedFiles $fixedFiles

# Calculate progress
$totalEstimatedFiles = 340  # From the tracking doc
$progressPercent = [math]::Round(($fixedFiles.Count / $totalEstimatedFiles) * 100, 1)

# Get trend from previous sessions
$trend = Get-ProgressTrend

# Get priority files for next session
$priorityFiles = if ($errorStats -and $errorStats.TopFiles) {
    Get-NextPriorityFiles -TopFilesWithErrors $errorStats.TopFiles
} else {
    @()
}

# Save session data
if ($errorStats -and -not $errorStats.Cached) {
    Save-SessionLog -ErrorStats $errorStats -FixedCount $fixedFiles.Count
}

# ============================================================================
# GENERATE DYNAMIC PROMPT
# ============================================================================

$prompt = @"
# TYPESCRIPT ERROR GUARDIAN - DYNAMIC SESSION CONTEXT

**Generated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Mode:** $(if ($errorStats.Cached) { "Cached Data" } else { "Live Analysis" })

---

## LIVE ERROR STATUS

"@

if ($errorStats) {
    $prompt += @"

| Metric | Value |
|--------|-------|
| **Total Errors** | $($errorStats.TotalErrors) |
| **Files with Errors** | $($errorStats.FileCount) |
| **Files Fixed** | $($fixedFiles.Count) |
| **Progress** | $progressPercent% complete |
| **Last Scan** | $($errorStats.Timestamp) |

"@

    if ($trend) {
        $errorTrendIcon = if ($trend.ErrorsDelta -lt 0) { "[DOWN]" } elseif ($trend.ErrorsDelta -gt 0) { "[UP]" } else { "[SAME]" }
        $prompt += @"

### Trend Since Last Session ($($trend.PreviousTimestamp))
- Errors: $errorTrendIcon $($trend.ErrorsDelta) ($($errorStats.TotalErrors) now)
- Fixed Files: +$($trend.FixedDelta) new

"@
    }
} else {
    $prompt += "`n*Run without ``-SkipTsc`` to get live error counts*`n"
}

# Recent session work
$prompt += @"

## RECENT SESSION PROGRESS

"@

if ($recentFixes.Today.Count -gt 0) {
    $prompt += @"

### Fixed Today ($($recentFixes.Today.Count) files)
"@
    foreach ($fix in $recentFixes.Today | Select-Object -First 10) {
        $prompt += "- ``$($fix.File)`` - $($fix.Notes)`n"
    }
    if ($recentFixes.Today.Count -gt 10) {
        $prompt += "- ...and $($recentFixes.Today.Count - 10) more`n"
    }
}

if ($recentFixes.Yesterday.Count -gt 0) {
    $prompt += @"

### Fixed Yesterday ($($recentFixes.Yesterday.Count) files)
"@
    foreach ($fix in $recentFixes.Yesterday | Select-Object -First 5) {
        $prompt += "- ``$($fix.File)``"
        if ($fix.Notes) { $prompt += " - $($fix.Notes)" }
        $prompt += "`n"
    }
    if ($recentFixes.Yesterday.Count -gt 5) {
        $prompt += "- ...and $($recentFixes.Yesterday.Count - 5) more`n"
    }
}

$prompt += @"

### Overall Progress
- **Total Fixed:** $($fixedFiles.Count) / ~$totalEstimatedFiles files
- **This Week:** $($recentFixes.ThisWeek.Count) files fixed
- **Remaining:** ~$($totalEstimatedFiles - $fixedFiles.Count) files

"@

# Priority recommendations
if ($priorityFiles.Count -gt 0) {
    $prompt += @"

## SUGGESTED NEXT FILES (by priority)

| Priority | File | Errors |
|----------|------|--------|
"@
    foreach ($pf in $priorityFiles) {
        $prompt += "| $($pf.Priority) | ``$($pf.File)`` | $($pf.ErrorCount) |`n"
    }
    $prompt += "`n"
}

# Add the static context
$prompt += @"

---

## COMPLETE IMPLEMENTATION CONTEXT

You are a senior TypeScript / React / Next.js engineer working on **MoshiMoshi** - a Japanese learning platform.

Your task is to fix TypeScript errors **without changing business logic**.

### Project Tech Stack
- Next.js 15.5.2, TypeScript, Firebase/Firestore
- Auth: Firebase Auth + Custom JWT Sessions
- Payments: Stripe
- State: Zustand + React Query
- Offline: IndexedDB + Service Workers

### Workflow Per Error

1. **Identify** - Copy the exact error message and location
2. **Understand** - What does this code do? Dependencies?
3. **Analyse** - Why is the type error happening?
4. **Plan** - Describe the minimal, safe fix
5. **Implement** - Apply changes, avoid ``any`` and ``!``
6. **Verify** - Run ``npx tsc --noEmit``
7. **Summarise** - Explain why the fix is safe
8. **Update Tracking** - Mark file fixed in ``docs/TYPESCRIPT_ERRORS_FILES.md``

### Fix Preferences

**PREFER:**
- Type narrowing with runtime checks
- Proper interfaces and type definitions
- Optional chaining (``?.``) and nullish coalescing (``??``)
- Firestore converters for typed collections

**AVOID:**
- ``any`` type (unless documented)
- ``!`` non-null assertions (unless justified)
- ``as unknown as T`` casting chains
- Changing logic to fix types

### DO NOT Modify (Unless Asked)
- Business rules and entitlement logic
- Payment/subscription flows (Stripe)
- Auth flows and session handling
- Review engine core algorithm
- Gamification XP/streak calculations

### Key Commands

``````powershell
# Full type check (2-3 min)
npx tsc --noEmit

# Count non-test errors
npx tsc --noEmit 2>&1 | Select-String "^src/.*error TS" | Where-Object { $_ -notmatch "\.test\." } | Measure-Object

# Dev server (errors = warnings)
npm run dev
``````

### Error Tracking Document

**CRITICAL:** After fixing any file, update ``docs/TYPESCRIPT_ERRORS_FILES.md``:

1. Add to the "Fixed Files" table:
   ``| \`src/path/to/file.ts\` | $(Get-Date -Format "yyyy-MM-dd") | Brief description |``

2. Update category counts in the Summary table

This prevents future sessions from duplicating work!

---

## SESSION START

**You are now fully briefed with live data.**

1. Review the "Suggested Next Files" above
2. Or pick from ``docs/TYPESCRIPT_ERRORS_FILES.md``
3. Fix errors following the workflow
4. Update the tracking document after each file
5. Commit frequently with descriptive messages

**Proceed with confidence!**
"@

# ============================================================================
# OUTPUT
# ============================================================================

# Output the prompt
Write-Output $prompt

# Save to file if requested
if ($OutputFile) {
    $prompt | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "`nPrompt saved to: $OutputFile" -ForegroundColor Green
    Write-Host "Lines: $($prompt.Split("`n").Count)" -ForegroundColor Gray
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Guardian Ready - $($fixedFiles.Count) files fixed so far" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
