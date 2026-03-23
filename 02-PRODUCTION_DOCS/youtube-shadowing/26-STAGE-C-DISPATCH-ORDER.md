# Stage C Dispatch Order

Recommended order:

1. `C1`
- raw transcript normalization
- reconstructed segment generation
- coarse player-segment contract

2. `C2` after `C1` is accepted
- page migration to computed player segments

3. `C3` after `C2` is accepted
- validation and benchmark pass

Sequence:
- `C1 -> C2 -> C3`

Keep Stage C linear for now.
