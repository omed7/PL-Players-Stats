# Feature Specification — GitHub Actions Supabase Snapshot Publication

**Status:** Approved route; implementation in progress
**Owner:** Manus AI
**Date:** 2026-08-19

## Outcome

The existing daily GitHub workflow will continue to fetch and validate the FPL dataset first. Only after those checks pass will it call a server-side Supabase RPC with a **user-managed GitHub Actions secret**. The RPC atomically records a successful sync run and publishes a new current snapshot, while an unchanged payload leaves the current snapshot intact.

## Scope and non-goals

| In scope | Explicitly out of scope |
| --- | --- |
| A Python publisher that validates a completed `players.json`, hashes it, and invokes a Supabase RPC. | Browser read-path cutover from `players.json` to Supabase. |
| A Supabase RPC that validates the payload shape and atomically publishes a current snapshot. | Placing a service-role key in the browser, repository, Vercel, or any committed configuration. |
| GitHub workflow wiring that reads `SUPABASE_SERVICE_ROLE_KEY` exclusively from repository secrets. | Removing the existing static JSON fallback before parity and browser-loader validation. |
| Tests for payload validation, secret absence, HTTP failure, unchanged publication, and current-snapshot safety. | SMTP/account activation, custom FDR, or a scheduler outside the existing GitHub daily workflow. |

## Publication contract

1. `fpl_fetcher.py` must complete its existing bootstrap, schema, history-completeness, and atomic-file-write checks before publication begins.
2. The publisher accepts schema-v2 output with a list-valued `players` field, a parseable `fetched_at`, and a player count matching the payload.
3. The publisher uses only `SUPABASE_SERVICE_ROLE_KEY` from GitHub repository secrets. The Supabase project URL is public configuration, not a privileged credential.
4. `publish_fpl_snapshot` executes inside one database transaction. It validates the payload, serializes publication, marks any previous current snapshot non-current, creates one new current snapshot, and updates the sync run to `published`.
5. If the payload hash matches the current snapshot, the RPC records a completed unchanged sync run and leaves the existing current snapshot untouched.
6. Any publisher or RPC failure fails the workflow before `players.json` is committed. The prior repository snapshot and prior database current snapshot therefore remain available.

## Security boundary

The RPC is `SECURITY DEFINER` and executable by `service_role` only. Anonymous and authenticated browser roles receive no execute grant, no write policy, and no service credential. The repository contains only the secret name, never a key value.

## Verification plan

| Concern | Verification |
| --- | --- |
| Valid payload | Python test confirms a schema-v2 payload produces the expected RPC request without exposing the credential. |
| Invalid payload | Python tests reject malformed schema, players shape, count, and timestamp before HTTP publication. |
| Missing secret | Python test fails clearly before HTTP publication. |
| HTTP/RPC failure | Python test raises and prevents a successful workflow continuation. |
| Atomic database behavior | Migration inspection plus a controlled service-role publication after the user configures the GitHub secret. |
| Workflow safety | CI runs full regression tests; workflow order publishes before any static-data commit. |
