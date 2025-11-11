# Streak Testing Tools Comparison

## Original vs Enhanced Scripts

### Original Script (`streak-time-travel.js`)
**Status:** ✅ Good foundation, works well for basic testing

**Strengths:**
- Interactive menu system
- Time travel (set dates)
- XP and streak manipulation
- Quick test scenarios (s1-s7)
- Reset functionality
- Good status display

**Limitations for Streak Save Testing:**
- ❌ No modal eligibility check
- ❌ Can't simulate save operation
- ❌ Doesn't show streakSaveCount
- ❌ No snapshot/rollback feature
- ❌ No streak save logs viewer
- ❌ Missing XP "set exact" (only add/subtract)
- ❌ Scenario 7 XP calculation could go negative

---

### Enhanced Script (`streak-time-travel-enhanced.js`)
**Status:** ✨ Optimized for Phase 2 streak save testing

## New Features

### 1. **Modal Eligibility Checker** ✨
Shows whether modal would appear based on current state:

```
🪟 MODAL WOULD APPEAR:
  ✅ YES
```

Or with reasons if not:
```
🪟 MODAL WOULD APPEAR:
  ❌ NO
  Reasons: Within grace period, Insufficient XP
```

**Implementation:**
```javascript
function checkModalEligibility(data) {
  // Checks all 6 trigger conditions:
  // 1. hasStreak (current > 0)
  // 2. hasActivityDate
  // 3. isStale (beyond 24h grace)
  // 4. withinWindow (2-3 days)
  // 5. canAfford XP
  // Returns: { wouldShow, reasons, cost, ... }
}
```

### 2. **Simulate Streak Save** 🧪
Menu option `14` - Simulates exactly what the API would do:

```bash
🔄 SIMULATING STREAK SAVE...
  Current XP: 100
  Cost: 50
  New XP: 50
  New Level: 1
  New lastActivityDate: 2025-11-05
Apply this change? (yes/no):
```

- ✅ Validates eligibility first
- ✅ Shows all changes before applying
- ✅ Increments `metadata.streakSaveCount`
- ✅ Sets date to "yesterday"
- ✅ Deducts XP and recalculates level
- ✅ Increments streak version

### 3. **Snapshot & Restore** 📸
Menu options `12` and `13`:

```bash
# Create snapshot
12. Create snapshot (NEW)

# Restore snapshot
13. Restore snapshot (NEW)
```

**Use case:** Test multiple paths without manual undo
```
1. Create snapshot
2. Test scenario s2 → simulate save
3. Restore snapshot
4. Test scenario s7 → check insufficient XP
5. Restore snapshot
```

### 4. **Set XP to Exact Amount** 🎯
Menu option `9`:

```bash
9. Set XP to exact amount (NEW)
```

**Why better:**
```bash
# Old way (add/subtract):
# Current: 165 XP
# Want: 50 XP
# Calculate: 50 - 165 = -115 ❌ confusing

# New way:
Set XP to: 50 ✅ direct
```

### 5. **View Streak Save Logs** 📝
Menu option `3`:

```bash
📝 STREAK SAVE LOGS (Last 10)
========================================
1. 2025-11-06T15:30:00.000Z
   Streak Saved: 10 days
   XP: 100 → 50 (-50)
   Days Late: 2
   Cost: 50 XP
   Date: 2025-11-04 → 2025-11-05
```

**Queries:** `streak_save_logs` collection created by API endpoint

### 6. **Enhanced Status Display** 📊
Shows new fields:
```bash
📊 CURRENT DATA:
  Streak Saves Used: 3       # NEW

💰 SAVE COST:
  New lastActivityDate would be: 2025-11-05  # NEW
  Time until grace expires: ~20 hours        # NEW
```

### 7. **Better Test Scenarios** 🎬
Added 3 new scenarios:

**s8 - Exactly Enough XP:**
```bash
10-day streak, 2 days late, exactly 50 XP
```
Tests edge case where XP === cost

**s9 - Just After Save:**
```bash
Yesterday (extended), reduced XP, ~20hr to act
```
Tests the post-save state

**s10 - Grace Boundary:**
```bash
Exactly 1 day ago, still safe
```
Tests the 24-hour grace period edge

### 8. **Fixed XP Setting** 🔧
Scenarios now use `setXP()` instead of `modifyXP()`:

```javascript
// Old (could go negative):
const deficit = 75 - currentXP;
await modifyXP(-deficit - 10); // ❌ Math error risk

// New (clean):
await setXP(50); // ✅ Clear intent
```

---

## Quick Comparison

| Feature | Original | Enhanced |
|---------|----------|----------|
| Time travel | ✅ | ✅ |
| Modify XP/streak | ✅ | ✅ |
| Test scenarios | 7 | 10 |
| Modal check | ❌ | ✅ |
| Simulate save | ❌ | ✅ |
| View logs | ❌ | ✅ |
| Snapshot/restore | ❌ | ✅ |
| Set exact XP | ❌ | ✅ |
| Save count tracking | ❌ | ✅ |

---

## Recommended Testing Workflow

### Using Enhanced Script:

**1. Initial State Check:**
```bash
node scripts/streak-time-travel-enhanced.js
# Menu: 1 (View status)
# Check: Modal eligibility, current XP, streak
```

**2. Create Baseline Snapshot:**
```bash
# Menu: 12 (Create snapshot)
```

**3. Test Scenario - Can Save:**
```bash
# Menu: s6 (Perfect save test)
# Menu: 1 (View status - should show "MODAL WOULD APPEAR: YES")
# Menu: 14 (Simulate save)
# Menu: 1 (Verify - XP deducted, date extended)
# Menu: 3 (View logs - should show save record)
```

**4. Restore and Test - Insufficient XP:**
```bash
# Menu: 13 (Restore snapshot)
# Menu: s7 (Insufficient XP test)
# Menu: 1 (Should show "MODAL WOULD APPEAR: NO - Insufficient XP")
```

**5. Test in Real App:**
```bash
# Open http://localhost:3000/dashboard
# Should see modal based on script's prediction
# Click save button
# Verify changes match simulation
```

**6. Verify Logs:**
```bash
# Menu: 3 (View save logs)
# Compare with Firestore console
```

**7. Cleanup:**
```bash
# Menu: 13 (Restore to original state)
# Or Menu: 11 (Reset streak)
```

---

## When to Use Which Script

### Use **Original** (`streak-time-travel.js`) for:
- ✅ Quick time travel testing
- ✅ Simple XP adjustments
- ✅ Setting up initial states
- ✅ General exploration

### Use **Enhanced** (`streak-time-travel-enhanced.js`) for:
- ✅ Testing streak save feature specifically
- ✅ Validating modal logic
- ✅ Simulating saves without UI
- ✅ Checking eligibility conditions
- ✅ Testing multiple scenarios with rollback
- ✅ Debugging XP cost calculations
- ✅ Viewing save history

---

## Running the Scripts

```bash
# Original
node scripts/streak-time-travel.js

# Enhanced
node scripts/streak-time-travel-enhanced.js

# Or if executable:
./scripts/streak-time-travel.js
./scripts/streak-time-travel-enhanced.js
```

---

## Recommendation

**Use the enhanced version** for Phase 2 testing. It adds critical features:
1. **Modal eligibility validation** - Predict before testing UI
2. **Save simulation** - Test backend logic without UI
3. **Snapshot/restore** - Fast iteration on test scenarios
4. **Logs viewer** - Verify transactions worked correctly
5. **Better scenarios** - Edge cases now covered

The original script is still good for general streak manipulation, but enhanced is purpose-built for streak save feature testing.

---

**Created:** 2025-11-06
**Purpose:** Phase 2 streak save feature testing
