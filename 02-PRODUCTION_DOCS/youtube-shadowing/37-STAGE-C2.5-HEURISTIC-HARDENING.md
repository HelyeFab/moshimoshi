# Stage C2.5: Heuristic Hardening

Purpose:
- make Stage C reconstruction less brittle before moving into alignment-heavy work

Why this stage exists:
- Stage C route and page contracts are now in place
- current reconstruction is better, but still deterministic and vulnerable to edge cases
- we want a stronger non-AI reconstruction layer before introducing alignment refinement

What C2.5 should improve:

1. Local decisions instead of one global transcript decision
- do not treat the whole transcript as preserve-or-rebuild
- evaluate small neighboring groups or clusters instead

2. Multi-signal scoring instead of brittle single rules
- combine:
  - text completeness
  - continuation likelihood
  - overlap/duplication
  - timing overlap
  - contamination
  - punctuation position

3. Confidence that means something
- confidence should reflect reconstruction uncertainty
- low-confidence segments should be identifiable for future correction/alignment work

4. Stronger invariants
- preserve already-good lineation locally
- repair only where evidence is strong
- avoid global degradation from one bad row

Non-goals:
- no AI segmentation
- no forced alignment
- no old youtube-shadowing imports
- no major route/page contract redesign

Expected output of C2.5:
- same high-level route/page contract
- better internal reconstruction decisions
- stronger tests covering mixed good/bad local regions in the same transcript
