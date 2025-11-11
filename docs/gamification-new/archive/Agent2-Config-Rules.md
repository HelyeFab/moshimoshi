# 👤 Agent 2 — Config & Rules

**Role:** Define and maintain config-driven gamification rules.

## Scope
- Create `xp.json`, `streak.json`, `achievements.json`.
- Define base XP rules (per correct, speed bonus).
- Define streak thresholds (≥10 XP/day).
- Encode ≤10 simple achievements (first session, 7-day streak, 100 reviews, etc.).
- Add level formula: `floor(totalXp / 1000)`.

## Deliverables
- `/config/xp.json`
- `/config/streak.json`
- `/config/achievements.json`
- Tests ensuring conditions evaluate correctly.

## Acceptance Tests
- XP/points match values in config.
- Streak increments only when XP/day ≥ threshold.
- Achievements unlock when conditions are met.
- Level increases correctly with XP.