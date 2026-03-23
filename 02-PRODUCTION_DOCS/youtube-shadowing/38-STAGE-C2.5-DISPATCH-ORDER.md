# Stage C2.5 Dispatch Order

Recommended order:

1. `H1` — heuristic hardening implementation
2. `H2` — validation delta after `H1` lands

Sequence:
- `H1 -> H2`

Why:
- the route/page contract already exists
- this is a narrow internal-quality pass
- validation should happen only after the hardening changes land
