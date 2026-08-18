# FPL Omed Agent Guidance

For every non-trivial change, follow [`docs/agent-workflow/FPL-Engineering-Guide.md`](docs/agent-workflow/FPL-Engineering-Guide.md) and create a specification from [`docs/agent-workflow/Feature-Spec-Template.md`](docs/agent-workflow/Feature-Spec-Template.md) before implementation.

## Critical invariants

- Never infer a blank gameweek from absent fixture data. Render `BGW` only from an authoritative explicit confirmation; otherwise show known fixtures or an unknown/unavailable state.
- Treat a valid zero-player preseason dataset as a season-not-started state, not a load error or filter result.
- Fail fetch/pipeline runs on bootstrap, schema, validation, or output-write failures; preserve the last known good data.
- Use FPL element IDs—not player display names—for durable user data.
- Use app-native auth and an optional public FPL Team ID. Never handle FPL passwords.
- Enforce all user-owned Supabase data through RLS with `user_id = auth.uid()`.

Keep changes small, test the relevant seam before implementing, verify against acceptance criteria, and avoid unrelated refactors.
