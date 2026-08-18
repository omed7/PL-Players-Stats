# FPL Omed Architecture Mapping Runbook

## When to create a map

Create a versioned architecture, workflow, sequence, data-flow, or lifecycle map when a change modifies a trust boundary, user-data flow, deployment model, external dependency, persistence mechanism, or scheduled data pipeline. Do not create diagrams merely to describe a small local UI change.

| Change | Required map |
|---|---|
| Current static pipeline or fetcher hardening | Data-flow map: FPL API → fetcher → validation → `players.json` → GitHub Actions → Vercel → browser. |
| Supabase migration | Architecture plus sequence map: browser auth, Supabase Auth, Postgres/RLS, user-preference reads/writes, and static FPL data. |
| Custom FDR | Data-flow map: source FDR, user custom venue ratings, calculation mode selection, and UI rendering. |
| Scheduled workflow change | Lifecycle map: trigger, retry, validation, publish/no-change/failure outcomes, and notification path. |

## Bounded mapping protocol

1. **State the map purpose.** Write one sentence describing the decision the reader must make with the map.
2. **Name the evidence.** Use the source commit, workflow file, schema, or approved specification. Clearly mark intended future components as proposed.
3. **Limit the scope.** Show 8–12 central components and one primary path. Put supporting facts in notes rather than creating a dense graph.
4. **Show boundaries.** Identify browser, third-party FPL API, GitHub Actions, Vercel, Supabase, and user-data trust boundaries where applicable.
5. **Separate fact from proposal.** Do not claim that a service, policy, or data field exists before implementation and verification.
6. **Validate and store.** Save the diagram source and exported HTML/SVG/PNG under `docs/architecture/`, naming artefacts with the relevant decision or change.

## Diagram request template

> Create a [architecture/workflow/sequence/data-flow/lifecycle] map for FPL Omed using the evidence in [files/commit]. The map’s purpose is [decision]. Show only [8–12] core components, the primary path, data classes, and trust boundaries. Mark future elements as proposed. Do not infer runtime behaviour beyond the source evidence. Export a source file and a shareable visual artefact to `docs/architecture/`.

## Tooling choice

Use Mermaid for an in-repository static diagram with modest detail. Use [Archify][1] when a richer, validated, standalone HTML explanation or an architecture share card adds real review value. Treat Archify as an on-demand project-local generation tool; it is not a background service or a mandatory development dependency.

## Review checklist

| Check | Pass condition |
|---|---|
| Factual grounding | Every existing component and edge can be traced to source code, configuration, or an approved specification. |
| Scope | The map answers one decision and does not become a general product poster. |
| Boundary clarity | External systems, authenticated user data, and internal application components are visually distinguishable. |
| Future-state honesty | Proposed components are clearly labelled; the map makes no availability or security claim that has not been implemented. |
| Versioning | Source and output are stored with the feature/specification that motivated them. |

## Reference

[1]: https://github.com/tt-a1i/archify "Archify"
